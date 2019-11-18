module.exports = {
    apps: [
        {
            name: "Indexer",
            script: "./launcher.js",
            node_args: ["--max-old-space-size=4096"],
            autorestart: false,
            kill_timeout: 3600,
            env: {
                PARSER: '1.8',
                START_ON: 0,
                STOP_ON: 0,
                AUTO_STOP: 0,
                REWRITE: 'false',
                PURGE_QUEUES: 'false',
                DISABLE_READING: 'false',
                ENABLE_INDEXING: 'true',
                ENABLE_STREAMING: 'false',
                STREAM_TRACES: 'false',
                STREAM_DELTAS: 'false',
                BATCH_SIZE: 5000,
                QUEUE_THRESH: 8000,
                LIVE_READER: 'true',
                LIVE_ONLY: 'false',
                FETCH_BLOCK: 'true',
                FETCH_TRACES: 'true',
                CHAIN: 'eos',
                SYSTEM_DOMAIN: 'eosio',
                CREATE_INDICES: 'v1',
                PREVIEW: 'false',
                READERS: 1,
                DESERIALIZERS: 1,
                DS_MULT: 1,
                ES_IDX_QUEUES: 1,
                ES_AD_IDX_QUEUES: 1,
                READ_PREFETCH: 50,
                BLOCK_PREFETCH: 100,
                INDEX_PREFETCH: 500,
                PROC_DELTAS: 'true',
                INDEX_DELTAS: 'true',
                INDEX_ALL_DELTAS: 'false',
                ABI_CACHE_MODE: 'false',
                PROPOSAL_STATE: 'false',
                ACCOUNT_STATE: 'false',
                VOTERS_STATE: 'false',
                USERRES_STATE: 'false',
                DELBAND_STATE: 'false',
                REPAIR_MODE: 'false',
                INDEX_TRANSFER_MEMO: 'false',
                DEBUG: 'false'
            }
        },
        {
            name: 'API',
            script: "./api/api-loader.js",
            exec_mode: 'cluster',
            merge_logs: true,
            instances: 1,
            autorestart: true,
            exp_backoff_restart_delay: 100,
            watch: ["api"],
            env: {
                PROVIDER_NAME: 'Provider Name',
                PROVIDER_URL: 'https://yourproviderwebsite',
                CHAIN: 'eos',
                CHAIN_NAME: 'EOS Mainnet',
                CHAIN_LOGO_URL: 'https://bloks.io/img/chains/eos.png',
                SERVER_PORT: '7000',
                SERVER_NAME: 'example.com',
                SERVER_ADDR: '127.0.0.1',
                ENABLE_CACHING: 'true',
                CACHE_LIFE: 30,
                ENABLE_WEBSOCKET: true,
                ENABLE_SOCKETIO: true,
            }
        }
    ]
};
