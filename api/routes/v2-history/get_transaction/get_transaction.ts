import {FastifyInstance, FastifyReply, FastifyRequest} from "fastify";
import {ServerResponse} from "http";
import {mergeActionMeta, timedQuery} from "../../../helpers/functions";

async function getTransaction(fastify: FastifyInstance, request: FastifyRequest) {

	const redis = fastify.redis;
	const trxId = request.query.id.toLowerCase();
	const cachedData = await redis.hgetall(trxId);

	let hits;
	let hits2;

	const response = {
		"query_time_ms": undefined,
		"cached": undefined,
		"cache_expires_in": undefined,
		"executed": false,
		"hot_only": false,
		"trx_id": trxId,
		"lib": undefined,
		"actions": [],
		"generated": undefined
	};

	if (cachedData && Object.keys(cachedData).length > 0) {
		const gsArr = [];
		for (let cachedDataKey in cachedData) {
			gsArr.push(cachedData[cachedDataKey]);
		}
		gsArr.sort((a, b) => {
			return a.global_sequence - b.global_sequence;
		});
		response.cache_expires_in = await redis.ttl(trxId);
		hits = gsArr.map(value => {
			return {_source: JSON.parse(value)}
		});
	}

	if (!hits) {
		const _size = fastify.manager.config.api.limits.get_trx_actions || 100;
		let indexPattern = fastify.manager.chain + '-action-*';
		if (request.query.hot_only) {
			indexPattern = fastify.manager.chain + '-action';
		}

		const pResults = await Promise.all([
			fastify.eosjs.rpc.get_info(),
			fastify.elastic.search({
				index: indexPattern,
				size: _size,
				body: {
					query: {bool: {must: [{term: {trx_id: request.query.id.toLowerCase()}}]}},
					sort: {global_sequence: "asc"}
				}
			}),
			fastify.elastic.search({
				index: fastify.manager.chain + '-gentrx-*',
				size: _size,
				body: {
					query: {bool: {must: [{term: {trx_id: request.query.id.toLowerCase()}}]}}
				}
			})
		]);

		const results = pResults[1];
		const genTrxRes = pResults[2];

		response.lib = pResults[0].last_irreversible_block_num;

		if (request.query.hot_only) {
			response.hot_only = true;
		}

		hits = results['body']['hits']['hits'];
		hits2 = genTrxRes['body']['hits']['hits'];
	}

	if (hits) {
		if (hits.length > 0) {
			let highestBlockNum = 0;
			for (let action of hits) {
				if (action._source.block_num > highestBlockNum) {
					highestBlockNum = action._source.block_num;
				}
			}
			for (let action of hits) {
				if (action._source.block_num === highestBlockNum) {
					action = action._source;
					mergeActionMeta(action);
					response.actions.push(action);
				}
			}
			response.executed = true;
		}
	}

	if (hits2 && hits2.length > 0) {
		if (hits2[0]._source['@timestamp']) {
			hits2[0]._source['timestamp'] = hits2[0]._source['@timestamp'];
			delete hits2[0]._source['@timestamp'];
		}
		response.generated = hits2[0]._source;
	}

	return response;
}

export function getTransactionHandler(fastify: FastifyInstance, route: string) {
	return async (request: FastifyRequest, reply: FastifyReply<ServerResponse>) => {
		reply.send(await timedQuery(getTransaction, fastify, request, route));
	}
}
