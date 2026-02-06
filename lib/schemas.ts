import { z } from 'zod';

export const ProductSchema = z.object({
  id: z.string().optional(), // Generated if missing
  name: z.string().min(1, "Product name is required"),
  category: z.string().default('General'),
  stock: z.number().min(0, "Stock cannot be negative").default(0),
  price: z.number().min(0).default(0),
  unit: z.string().default('pcs'),
  minStock: z.number().min(0).default(5),
  location: z.string().optional(),
  status: z.enum(['Active', 'Discontinued']).default('Active')
});

export const TransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  sku: z.string().min(1, "SKU/Product Name is required"),
  qty: z.number().positive("Quantity must be positive"),
  price: z.number().min(0).optional(),
  unit: z.string().optional(),
  docRef: z.string().optional().default(''), // PO Number or Note
  type: z.enum(['IN', 'OUT'])
});

export const JobSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['General', 'Maintenance', 'Delivery']),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  status: z.enum(['Pending', 'In Progress', 'Completed', 'Cancelled']),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  location: z.string().optional()
});

export type Product = z.infer<typeof ProductSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type Job = z.infer<typeof JobSchema>;
