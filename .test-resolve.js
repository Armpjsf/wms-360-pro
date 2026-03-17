const { resolveSpreadsheetId } = require('./lib/googleSheets.js');

async function test() {
    console.log("Testing FMC inventory:")
    console.log(await resolveSpreadsheetId('fmc', 'inventory'));
    console.log("Testing FMC doc:")
    console.log(await resolveSpreadsheetId('fmc', 'doc'));
}

test().catch(console.error);
