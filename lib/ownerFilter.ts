/**
 * Owner-based Data Isolation Utilities
 * For filtering transactions and products by the logged-in user's allowed owners.
 */

import { Transaction } from './googleSheets';

/**
 * Check if a user has access to a specific owner
 * @param userOwners The user's allowedOwners array (from session)
 * @param itemOwner The owner of the item/transaction
 * @returns true if user can access this owner's data
 */
export function canAccessOwner(userOwners: string[] | undefined, itemOwner: string | undefined): boolean {
    // If user has no owner restrictions (admin) or allowed all ['*']
    if (!userOwners || userOwners.length === 0 || userOwners.includes('*')) {
        return true;
    }
    
    // If item has no owner, allow access (legacy data)
    if (!itemOwner || itemOwner === '') {
        return true;
    }

    // Check if item's owner is in user's allowed list (case-insensitive)
    return userOwners.some(allowed => 
        allowed.toLowerCase() === (itemOwner || '').toLowerCase()
    );
}

/**
 * Filter transactions by user's allowed owners
 */
export function filterTransactionsByOwner(
    transactions: Transaction[], 
    userOwners: string[] | undefined
): Transaction[] {
    if (!userOwners || userOwners.length === 0 || userOwners.includes('*')) {
        return transactions;
    }

    return transactions.filter(t => canAccessOwner(userOwners, t.owner));
}

/**
 * Filter any array of items with an 'owner' field
 */
export function filterByOwner<T extends { owner?: string }>(
    items: T[],
    userOwners: string[] | undefined
): T[] {
    if (!userOwners || userOwners.length === 0 || userOwners.includes('*')) {
        return items;
    }

    return items.filter(item => canAccessOwner(userOwners, item.owner));
}
