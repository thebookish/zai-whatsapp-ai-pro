
import { Response } from "express";

export const sendJson = (res: Response, status: number, data: unknown) => res.status(status).json(data);
