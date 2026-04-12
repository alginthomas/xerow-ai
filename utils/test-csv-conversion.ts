/**
 * Test script for CSV to Item Carousel conversion
 * 
 * This script demonstrates how to convert the Kudzu Applicants CSV data
 * to Item Carousel format for testing.
 * 
 * Usage:
 *   - Install dependencies: npm install csv-parse
 *   - Run: npx ts-node utils/test-csv-conversion.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { convertCSVRowsToItemCarousel, mapCSVRowToItemCarouselItem } from './csv-to-item-carousel';

const CSV_FILE_PATH = path.join(process.env.HOME || '', 'Downloads', 'Kudzu Applicants Tracking System V1.csv');

/**
 * Read and parse CSV file
 */
function readCSVFile(filePath: string): Record<string, any>[] {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    // Parse CSV with headers
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true, // Handle inconsistent column counts
      trim: true,
    });
    
    return records;
  } catch (error) {
    console.error('Error reading CSV file:', error);
    throw error;
  }
}

/**
 * Test conversion with sample data
 */
function testConversion() {
  console.log('📊 Testing CSV to Item Carousel Conversion\n');
  console.log(`Reading CSV from: ${CSV_FILE_PATH}\n`);
  
  // Check if file exists
  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`❌ CSV file not found at: ${CSV_FILE_PATH}`);
    console.log('\nPlease update CSV_FILE_PATH in this script to point to your CSV file.');
    return;
  }
  
  try {
    // Read CSV
    const csvRows = readCSVFile(CSV_FILE_PATH);
    console.log(`✅ Successfully parsed ${csvRows.length} rows from CSV\n`);
    
    // Test with first 5 rows
    const sampleRows = csvRows.slice(0, 5);
    console.log('📋 Testing with first 5 rows:\n');
    
    sampleRows.forEach((row, index) => {
      console.log(`\n--- Row ${index + 1} ---`);
      console.log('Original CSV data:');
      console.log(`  Candidate ID: ${row['Candidate ID']}`);
      console.log(`  Name: ${row['Candidate Full Name']}`);
      console.log(`  Skill: ${row['Skill']}`);
      console.log(`  Expected CTC: ${row['Expected CTC']}`);
      console.log(`  Status: ${row['Status']}`);
      console.log(`  Stage: ${row['Stage']}`);
      
      // Convert to Item Carousel format
      const item = mapCSVRowToItemCarouselItem(row);
      console.log('\nConverted Item Carousel item:');
      console.log(JSON.stringify(item, null, 2));
    });
    
    // Convert all rows to Item Carousel
    console.log('\n\n🔄 Converting all rows to Item Carousel format...\n');
    const itemCarousel = convertCSVRowsToItemCarousel(
      csvRows,
      'Kudzu Applicants Tracking System',
      `Showing ${csvRows.length} applicants from the tracking system`
    );
    
    console.log('✅ Conversion complete!');
    console.log(`\nSummary:`);
    console.log(`  Total items: ${itemCarousel.items.length}`);
    console.log(`  Title: ${itemCarousel.title}`);
    console.log(`  Description: ${itemCarousel.description}`);
    
    // Show statistics
    const withPrice = itemCarousel.items.filter(item => item.price !== undefined).length;
    const withImage = itemCarousel.items.filter(item => item.image !== undefined).length;
    const withSubtitle = itemCarousel.items.filter(item => item.subtitle !== undefined).length;
    
    console.log(`\nStatistics:`);
    console.log(`  Items with price: ${withPrice} (${Math.round(withPrice / itemCarousel.items.length * 100)}%)`);
    console.log(`  Items with image: ${withImage} (${Math.round(withImage / itemCarousel.items.length * 100)}%)`);
    console.log(`  Items with subtitle: ${withSubtitle} (${Math.round(withSubtitle / itemCarousel.items.length * 100)}%)`);
    
    // Save sample output to file
    const outputPath = path.join(__dirname, 'sample-item-carousel-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(itemCarousel, null, 2));
    console.log(`\n💾 Sample output saved to: ${outputPath}`);
    
    // Save first 10 items as a smaller test file
    const sampleCarousel = {
      ...itemCarousel,
      items: itemCarousel.items.slice(0, 10),
      description: 'Sample of first 10 applicants',
    };
    const sampleOutputPath = path.join(__dirname, 'sample-10-items.json');
    fs.writeFileSync(sampleOutputPath, JSON.stringify(sampleCarousel, null, 2));
    console.log(`💾 Sample 10 items saved to: ${sampleOutputPath}`);
    
  } catch (error) {
    console.error('❌ Error during conversion:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

// Run test if executed directly
if (require.main === module) {
  testConversion();
}

export { testConversion, readCSVFile };
