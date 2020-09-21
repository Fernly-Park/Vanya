import { isAnEmptyString } from "@App/utils/stringUtils";


export default {
    port: process.env.PORT,
    log: {
        level: process.env.LOG_LEVEL,
        path: process.env.LOG_PATH
    },
    authentication: {
        useAWSSigning: process.env.USE_AWS_SIGNING,
        methods: isAnEmptyString(process.env.AUTHENTICATION_METHODS) ? [] : process.env.AUTHENTICATION_METHODS.split(' '),
        jwtSecret: process.env.JWT_SECRET,
        redirectURL: process.env.REDIRECT_URL,
        google: {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL
        }
    },
    connection_string: process.env.PG_CONNECTION_STRING,
    region: process.env.REGION,
    encryptUserSecret: process.env.ENCRYPT_USER_SECRET,
    redis_prefix: process.env.REDIS_PREFIX,
    redisBlockingTimeout: process.env.REDIS_BLOCKING_TIMEOUT ? parseInt(process.env.REDIS_BLOCKING_TIMEOUT) : 0,
    timerPollIntervalMs: process.env.TIMER_POLL_INTERVAL_MS ? parseInt(process.env.TIMER_POLL_INTERVAL_MS) : 500,
}; 