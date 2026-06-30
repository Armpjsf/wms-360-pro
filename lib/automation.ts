
import { AutomationRule, getRules, saveRule } from "./googleSheets";

// -------------------------------------------------------------
// TYPES & INTERFACES
// -------------------------------------------------------------

export interface Condition {
    field: string; // e.g., 'stock', 'qty', 'category'
    operator: '>' | '<' | '==' | '!=' | 'CONTAINS';
    value: string | number;
}

export interface Action {
    type: 'LOG_ALERT' | 'LINE_NOTIFY' | 'EMAIL';
    payload: any; // { message: "Low stock!" }
}

// -------------------------------------------------------------
// EVALUATOR ENGINE
// -------------------------------------------------------------

/**
 * Checks if a context (data object) satisfies a rule's condition.
 */
export function evaluateCondition(data: any, conditionJson: string): boolean {
    try {
        const cond: Condition = JSON.parse(conditionJson);
        const fieldValue = data[cond.field];
        
        // Coerce types if needed
        const val = typeof fieldValue === 'number' ? Number(cond.value) : cond.value;

        switch (cond.operator) {
            case '>': return fieldValue > val;
            case '<': return fieldValue < val;
            case '==': return fieldValue == val; // Loose equality allowed
            case '!=': return fieldValue != val;
            case 'CONTAINS': return String(fieldValue).includes(String(val));
            default: return false;
        }
    } catch (e) {
        console.error("Failed to parse condition:", e);
        return false;
    }
}

/**
 * Main Trigger Function for STOCK_LEVEL events
 * Callable from API after stock update.
 */
export async function checkStockRules(sku: string, currentStock: number) {
    console.log(`[Automation] Checking rules for ${sku} (Stock: ${currentStock})`);
    
    const rules = await getRules();
    const stockRules = rules.filter(r => r.triggerType === 'STOCK_LEVEL' && r.isActive);

    for (const rule of stockRules) {
        // Evaluate
        // Context for Stock Level is { sku, stock }
        const context = { sku, stock: currentStock };
        
        if (evaluateCondition(context, rule.condition)) {
            console.log(`[Automation] Rule Matched: ${rule.name}`);
            await executeAction(rule, context);
        }
    }
}

/**
 * Execute the defined action
 */
async function executeAction(rule: AutomationRule, context: any) {
    try {
        const action: Action = JSON.parse(rule.action);
        
        console.log(`[Automation] Executing Action: ${action.type}`, action.payload);

        // Record Last Triggered
        const updatedRule = { ...rule, lastTriggered: new Date().toISOString() };
        await saveRule(updatedRule);

        // TRIGGER PUSH NOTIFICATION — both FCM (APK) and Web Push (PWA)
        if (action.type === 'LOG_ALERT' || action.type === 'LINE_NOTIFY' || action.type === 'EMAIL') {
            const message = action.payload?.message || `Rule '${rule.name}' matched!`;
            const title = "📢 แจ้งเตือนคลังสินค้า";
            const body = `${message} (${context.sku})`;

            // FCM — APK
            try {
                const { sendFcmToDevices } = await import('./fcmSender');
                await sendFcmToDevices({
                    title,
                    body,
                    data: { type: 'stock_alert', sku: String(context.sku) },
                }, { tag: 'Automation' });
            } catch (fcmErr) {
                console.error("[Automation] FCM Failed:", fcmErr);
            }

            // Web Push — PWA
            try {
                const { sendWebPush } = await import('./webPushSender');
                await sendWebPush({ title, body, url: '/inventory?status=LOW' });
            } catch (pushErr) {
                console.error("[Automation] Web Push Failed:", pushErr);
            }
        }
        
    } catch (e) {
        console.error(`[Automation] Action failed for rule ${rule.name}`, e);
    }
}
