const { pool } = require('./src/db');
(async () => {
    try {
        const from = '2026-03-01';
        const to = '2026-04-01';
        const uid = 1;
        const [rows] = await pool.query(`
      SELECT 
        c.id AS customer_id,
        c.name AS customer_name,
        i.id AS item_id,
        i.name AS item_name,
        b.id AS bill_id,
        b.bill_number,
        b.bill_date,
        bi.size,
        SUM(bi.quantity) AS quantity,
        SUM(bi.total) AS amount,
        CASE WHEN b.grand_total > 0 
             THEN SUM(bi.total) / b.grand_total * b.paid_amount
             ELSE 0 END AS paid_alloc,
        CASE WHEN b.grand_total > 0 
             THEN SUM(bi.total) / b.grand_total * b.pending_amount
             ELSE 0 END AS pending_alloc
      FROM bills b
      JOIN customers c ON b.customer_id = c.id
      JOIN bill_items bi ON bi.bill_id = b.id
      JOIN items i ON bi.item_id = i.id
      WHERE b.bill_date >= ? AND b.bill_date < ? AND b.user_id = ?
      GROUP BY c.id, i.id, bi.size, b.id
      ORDER BY c.name ASC, i.name ASC, bi.size ASC, b.bill_date ASC, b.id ASC
        `, [from, to, uid]);
        console.log('Report row count:', rows.length);
        if (rows.length > 0) {
            console.log('First row:', JSON.stringify(rows[0]));
        }
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
