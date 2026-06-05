"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const googleSheets_1 = require("../lib/googleSheets");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const SSID = "1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM";
        const { googleSheets } = yield (0, googleSheets_1.getGoogleSheets)();
        console.log("--- Inspecting '📱 Devices' ---");
        try {
            const res = yield googleSheets.spreadsheets.values.get({
                spreadsheetId: SSID,
                range: "'📱 Devices'!A1:C10",
            });
            console.log("Values found:", res.data.values);
        }
        catch (err) {
            console.error("Failed to read '📱 Devices' sheet:", err.message);
        }
    });
}
main().catch(console.error);
