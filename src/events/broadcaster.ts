import { EventEmitter } from "events";

export const stockBroadcaster = new EventEmitter();
stockBroadcaster.setMaxListeners(0);

