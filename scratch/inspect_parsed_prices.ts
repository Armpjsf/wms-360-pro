import { getProductsUncached } from "../lib/googleSheets";

async function main() {
  const products = await getProductsUncached();
  console.log(`Parsed ${products.length} products.`);
  console.log("\nSample parsed products with their price and stock:");
  products.slice(0, 10).forEach(p => {
    console.log(`- Product: "${p.name}" | Stock: ${p.stock} | Price (Cost): ${p.price} | Value: ${p.stock * p.price}`);
  });
}

main().catch(console.error);
