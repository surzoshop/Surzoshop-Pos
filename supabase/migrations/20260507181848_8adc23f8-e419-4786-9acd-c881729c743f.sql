DELETE FROM sale_items WHERE sale_id = '740ef95c-d59b-4af3-bf7a-f6ae8a03cfef';
DELETE FROM sales WHERE id = '740ef95c-d59b-4af3-bf7a-f6ae8a03cfef';
UPDATE products SET stock = stock + 1 WHERE id = '423ac85d-7963-4f77-a5cb-b9949036e8d9';