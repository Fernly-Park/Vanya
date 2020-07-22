declare namespace Express {
    export interface Request {
        cookies: {
           jwt?: string
       }
    }
 }