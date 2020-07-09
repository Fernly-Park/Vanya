export default {
    port: process.env.PORT,
    log: {
        level: process.env.LOG_LEVEL,
        path: process.env.LOG_PATH
    },
    connection_string: process.env.PG_CONNECTION_STRING,
    region: process.env.REGION
}; 