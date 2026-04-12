"""
Data migration script to migrate products from catalog.json to Supabase.
Run this once to populate the database with existing products.
"""
import json
import logging
from supabase_client import bulk_insert_products, supabase

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def migrate_catalog():
    """Migrate products from catalog.json to Supabase"""
    
    # Read existing catalog
    logger.info("Reading catalog.json...")
    with open("catalog.json") as f:
        products = json.load(f)
    
    logger.info(f"Found {len(products)} products to migrate")
    
    # Add description field if missing (for better embeddings)
    for product in products:
        if 'description' not in product:
            product['description'] = f"{product['brand']} {product['title']} - {product['category']}"
    
    # Check if products already exist
    logger.info("Checking for existing products...")
    existing = supabase.table('products').select('id').execute()
    existing_ids = {p['id'] for p in existing.data}
    
    if existing_ids:
        logger.warning(f"Found {len(existing_ids)} existing products in database")
        response = input("Do you want to delete existing products and re-migrate? (yes/no): ")
        if response.lower() == 'yes':
            logger.info("Deleting existing products...")
            for product_id in existing_ids:
                supabase.table('products').delete().eq('id', product_id).execute()
            logger.info("Deleted all existing products")
        else:
            # Filter out existing products
            products = [p for p in products if p['id'] not in existing_ids]
            logger.info(f"Will insert {len(products)} new products")
    
    if not products:
        logger.info("No products to migrate")
        return
    
    # Insert products with embeddings
    logger.info("Generating embeddings and inserting products...")
    logger.info("This may take a moment depending on the number of products...")
    
    try:
        inserted = bulk_insert_products(products)
        logger.info(f"Successfully migrated {len(inserted)} products!")
        
        # Display sample
        logger.info("\nSample migrated products:")
        for product in inserted[:3]:
            logger.info(f"  - {product['id']}: {product['title']} (₹{product['price']})")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Product Migration Script - catalog.json → Supabase")
    logger.info("=" * 60)
    
    try:
        migrate_catalog()
        logger.info("\n✅ Migration completed successfully!")
    except Exception as e:
        logger.error(f"\n❌ Migration failed: {e}")
        exit(1)
