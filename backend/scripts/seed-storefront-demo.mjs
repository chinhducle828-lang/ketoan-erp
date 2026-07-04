import { pool } from '../config/db.js';

async function seedStorefrontDemo() {
  try {
    const companyRes = await pool.query(
      `INSERT INTO companies (name, tax_code, address)
       VALUES ($1, $2, $3)
       ON CONFLICT (tax_code) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address
       RETURNING id`,
      ['Cong ty VLXD Demo', '0999999999', 'TP Ho Chi Minh']
    );

    const companyId = companyRes.rows[0].id;

    const items = [
      {
        code: 'GACH-01',
        name: 'Gach xay do 2 lo',
        unit: 'Vien',
        price: 12500,
        images: [
          'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=800&q=80'
        ]
      },
      {
        code: 'XI-01',
        name: 'Xi mang PCB40',
        unit: 'Bao',
        price: 92000,
        images: ['https://images.unsplash.com/photo-1599707254554-027aeb4deacd?auto=format&fit=crop&w=800&q=80']
      },
      {
        code: 'THEP-01',
        name: 'Thep cay D16',
        unit: 'Cay',
        price: 185000,
        images: ['https://images.unsplash.com/photo-1581093458791-9d15482442f8?auto=format&fit=crop&w=800&q=80']
      },
      {
        code: 'SON-01',
        name: 'Son noi that chong am',
        unit: 'Thung',
        price: 560000,
        images: ['https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=800&q=80']
      },
      {
        code: 'ONG-01',
        name: 'Ong nhua PVC Phi 90',
        unit: 'Cay',
        price: 149000,
        images: ['https://images.unsplash.com/photo-1606471191009-63994c53433b?auto=format&fit=crop&w=800&q=80']
      },
      {
        code: 'CAT-01',
        name: 'Cat vang xay to',
        unit: 'm3',
        price: 390000,
        images: ['https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80']
      }
    ];

    for (const item of items) {
      await pool.query(
        `INSERT INTO items (company_id, item_code, item_name, code, name, unit, price_sell, image_url, image_urls)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         ON CONFLICT (company_id, code)
         DO UPDATE SET
           item_code = EXCLUDED.item_code,
           item_name = EXCLUDED.item_name,
           name = EXCLUDED.name,
           unit = EXCLUDED.unit,
           price_sell = EXCLUDED.price_sell,
           image_url = EXCLUDED.image_url,
           image_urls = EXCLUDED.image_urls`,
        [companyId, item.code, item.name, item.code, item.name, item.unit, item.price, item.images[0], JSON.stringify(item.images)]
      );
    }

    console.log(`SEEDED_COMPANY_ID=${companyId}`);
    console.log(`SEEDED_ITEMS=${items.length}`);
  } catch (error) {
    console.error('SEED_ERROR:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seedStorefrontDemo();
