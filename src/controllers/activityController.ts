import * as express from "express";
import { logInfo } from '../modules/logging'

const router = express.Router();

router.get('/', (req, resp) => {
    resp.status(201).send();
});

export default router;