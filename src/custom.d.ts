import { IUser } from "./components/user/user.interfaces";

declare namespace Express {
    export interface Request {
        
        cookies: {
           jwt?: string
       }
    }
 }