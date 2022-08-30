import { createSafeInvoker } from "tauri-safe-invoke";
import {z} from "zod";

const getHelloWorld = createSafeInvoker("get_hello_world", z.string())<void>;
getHelloWorld().then(result => result.ok && result.data) // result.data is string