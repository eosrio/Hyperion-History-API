const {action_blacklist} = require('../../definitions/blacklists');
const {action_whitelist} = require('../../definitions/whitelists');
const {deserialize, debugLog} = require('../../helpers/functions');
const {TextEncoder, TextDecoder} = require('util');
const txDec = new TextDecoder();
const txEnc = new TextEncoder();

const config = require(`../../${process.env.CONFIG_JSON}`);
const chain = config.settings.chain;

function checkBlacklist(act) {
    if (action_blacklist.has(`${chain}::${act['account']}::*`)) {
        return true;
    } else return action_blacklist.has(`${chain}::${act['account']}::${act['name']}`);
}

function checkWhitelist(act) {
    if (action_whitelist.has(`${chain}::${act['account']}::*`)) {
        return true;
    } else return action_whitelist.has(`${chain}::${act['account']}::${act['name']}`);
}

const reading_mode = process.env.live_mode;

module.exports = {
    actionParser: async (common, ts, action, trx_data, _actDataArray, _processedTraces, full_trace) => {
        let act = action['act'];

        // abort if blacklisted
        if (checkBlacklist(act)) {
            return false;
        }

        if (action_whitelist.size > 0) {
            if (!checkWhitelist(act)) {
                return false;
            }
        }

        const {trx_id, block_num, producer, cpu_usage_us, net_usage_words} = trx_data;
        const original_act = Object.assign({}, act);
        let ds_act;
        try {

            ds_act = await common.deserializeActionAtBlockNative(act, block_num);
            action['act']['data'] = ds_act;
            common.attachActionExtras(action);

            // report deserialization event
            process.send({
                event: 'ds_action'
            });
        } catch (e) {
            console.log(e);
            // write error to CSV
            process.send({
                event: 'ds_error',
                data: {
                    type: 'action_ds_error',
                    block: block_num,
                    account: act.account,
                    action: act.name,
                    gs: parseInt(action['receipt'][1]['global_sequence'], 10),
                    message: e.message
                }
            });
            action['act'] = original_act;
            action['act']['data'] = Buffer.from(action['act']['data']).toString('hex');
        }

        action['@timestamp'] = ts;
        action['block_num'] = block_num;
        action['producer'] = producer;
        action['trx_id'] = trx_id;
        if (action['account_ram_deltas'].length === 0) {
            delete action['account_ram_deltas'];
        }
        if (action['console'] === '') {
            delete action['console'];
        }
        if (action['except'] === null) {
            if (!action['receipt']) {
                console.log(full_trace.status);
                console.log(action);
            }
            action['receipt'] = action['receipt'][1];
            action['global_sequence'] = parseInt(action['receipt']['global_sequence'], 10);
            delete action['except'];
            delete action['error_code'];

            // add usage data to the first action on the transaction
            if (action['action_ordinal'] === 1 && action['creator_action_ordinal'] === 0) {
                action['cpu_usage_us'] = cpu_usage_us;
                action['net_usage_words'] = net_usage_words;
            }
            _processedTraces.push(action);
        } else {
            console.log(action);
        }
        return true;
    },
    messageParser: async (common, messages, types, ch, ch_ready) => {
        for (const message of messages) {
            const ds_msg = common.deserializeNative('result', message.content);
            const res = ds_msg[1];
            let block, traces = [], deltas = [];

            if (res.block && res.block.length) {
                // block = deserialize('signed_block', res.block, txEnc, txDec, types);
                // console.log( new Uint8Array(Buffer.from(res.block)));
                block = common.deserializeNative('signed_block', res.block);
                if (block === null) {
                    console.log(res);
                }
            }

            if (res['traces'] && res['traces'].length) {
                // traces = deserialize('transaction_trace[]', res['traces'], txEnc, txDec, types);
                try {
                    traces = common.deserializeNative('transaction_trace[]', res['traces']);
                } catch (e) {
                    console.log(e);
                    console.log(res);
                }
            }

            if (res['deltas'] && res['deltas'].length) {
                // deltas = deserialize('table_delta[]', res['deltas'], txEnc, txDec, types);
                deltas = common.deserializeNative('table_delta[]', res['deltas']);
            }

            let result;
            try {
                const t0 = Date.now();
                result = await common.processBlock(res, block, traces, deltas);
                const elapsedTime = Date.now() - t0;
                if (elapsedTime > 10) {
                    debugLog(`[WARNING] Deserialization time for block ${result['block_num']} was too high, time elapsed ${elapsedTime}ms`);
                }
                if (result) {
                    const evPayload = {
                        event: 'consumed_block',
                        block_num: result['block_num'],
                        live: reading_mode
                    };
                    if (block) {
                        evPayload["producer"] = block['producer'];
                    }
                    process.send(evPayload);
                } else {
                    console.log('Empty message. No block');
                    console.log(_.omit(res, ['block', 'traces', 'deltas']));
                }
                if (ch_ready) {
                    ch.ack(message);
                }
            } catch (e) {
                console.log(e);
                if (ch_ready) {
                    ch.nack(message);
                }
            }
        }
    }
};
