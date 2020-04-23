import * as fastify_static from "fastify-static";
import {join} from "path";
import {FastifyInstance, FastifyReply, FastifyRequest} from "fastify";
import {ServerResponse} from "http";
import {createReadStream} from "fs";
import * as AutoLoad from "fastify-autoload";

function addRedirect(server: FastifyInstance, url: string, redirectTo: string) {
    server.route({
        url,
        method: 'GET',
        schema: {hide: true},
        handler: async (request, reply) => {
            reply.redirect(redirectTo);
        }
    });
}

function addRoute(server: FastifyInstance, handlersPath: string, prefix: string) {
    server.register(AutoLoad, {
        dir: join(__dirname, 'routes', handlersPath),
        ignorePattern: /.*(handler|schema).js/,
        options: {prefix}
    });
}

export function registerRoutes(server: FastifyInstance) {

    // Register fastify api routes
    addRoute(server, 'v2', '/v2');
    addRoute(server, 'v2-history', '/v2/history');
    addRoute(server, 'v2-state', '/v2/state');
    addRoute(server, 'v1-history', '/v1/history');
    addRoute(server, 'v1-trace', '/v1/trace_api');
    // addRoute(server,'v1-chain', '/v1/chain');

    // Serve integrated explorer
    if (server.manager.config.api.enable_explorer) {
        server.register(fastify_static, {
            root: join(__dirname, '..', 'hyperion-explorer', 'dist'),
            redirect: true,
            wildcard: true,
            prefix: '/v2/explore'
        });
    }

    server.get('/v2/explorer_metadata', {schema: {tags: ['internal']}}, async (request, reply) => {
        reply.send({
            logo: server.manager.config.api.chain_logo_url,
            provider: server.manager.config.api.provider_name,
            provider_url: server.manager.config.api.provider_url,
            chain_name: server.manager.config.api.chain_name,
            chain_id: server.manager.conn.chains[server.manager.chain].chain_id
        });
    });

    // steam client lib
    server.get('/stream-client.js', {schema: {tags: ['internal']}}, (request: FastifyRequest, reply: FastifyReply<ServerResponse>) => {
        const stream = createReadStream('./client_bundle.js');
        reply.type('application/javascript').send(stream);
    });

    // Redirect routes to documentation
    addRedirect(server, '/v2', '/v2/docs');
    addRedirect(server, '/v2/history', '/v2/docs/index.html#/history');
    addRedirect(server, '/v2/state', '/v2/docs/index.html#/state');
}
