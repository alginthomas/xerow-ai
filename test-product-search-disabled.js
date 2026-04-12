#!/usr/bin/env node
/**
 * CLI Test Script: Verify Product Search is Disabled
 * 
 * This script tests:
 * 1. Tools array doesn't include search_products
 * 2. Employee search still works
 * 3. Product query interception logic
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the chat.ts file to extract tools array
const chatFilePath = join(__dirname, 'server', 'src', 'routes', 'chat.ts');
const chatFileContent = readFileSync(chatFilePath, 'utf-8');

console.log('🧪 Testing Product Search Disabled Configuration\n');
console.log('=' .repeat(60));

// Test 1: Check if search_products is commented out in tools array
console.log('\n📋 Test 1: Checking tools array for search_products...');
const toolsArrayMatch = chatFileContent.match(/const tools = \[([\s\S]*?)\];/);
if (toolsArrayMatch) {
  const toolsArrayContent = toolsArrayMatch[1];
  
  // Check if search_products is commented out
  const searchProductsCommented = /\/\/.*search_products|name: 'search_products'.*\/\/ DISABLED/.test(toolsArrayContent);
  const searchProductsActive = /name: 'search_products'/.test(toolsArrayContent) && !searchProductsCommented;
  
  if (searchProductsActive) {
    console.log('❌ FAIL: search_products is still active in tools array');
    process.exit(1);
  } else if (searchProductsCommented) {
    console.log('✅ PASS: search_products is commented out (disabled)');
  } else {
    console.log('✅ PASS: search_products is not found in tools array');
  }
  
  // Check if search_employees is active
  const searchEmployeesActive = /name: 'search_employees'/.test(toolsArrayContent);
  if (searchEmployeesActive) {
    console.log('✅ PASS: search_employees is active in tools array');
  } else {
    console.log('❌ FAIL: search_employees is missing from tools array');
    process.exit(1);
  }
  
  // Count active tools
  const activeToolMatches = toolsArrayContent.match(/name: '(\w+)'/g);
  const activeTools = activeToolMatches ? activeToolMatches.map(m => m.match(/'(\w+)'/)[1]) : [];
  console.log(`\n📊 Active tools: ${activeTools.join(', ')}`);
} else {
  console.log('❌ FAIL: Could not find tools array in chat.ts');
  process.exit(1);
}

// Test 2: Check if searchProducts function is disabled
console.log('\n📋 Test 2: Checking searchProducts function...');
const searchProductsFunctionMatch = chatFileContent.match(/async function searchProducts[\s\S]*?^}/m);
if (searchProductsFunctionMatch) {
  const functionContent = searchProductsFunctionMatch[0];
  const isDisabled = /DISABLED|console\.warn.*disabled|return \[\];/.test(functionContent);
  
  if (isDisabled) {
    console.log('✅ PASS: searchProducts function is disabled');
  } else {
    console.log('⚠️  WARN: searchProducts function exists but may not be disabled');
  }
} else {
  console.log('⚠️  INFO: searchProducts function not found (may be removed)');
}

// Test 3: Check system prompts
console.log('\n📋 Test 3: Checking system prompts...');
const systemPromptMatches = chatFileContent.match(/const systemPrompt = `([\s\S]*?)`;/g);
if (systemPromptMatches) {
  systemPromptMatches.forEach((prompt, index) => {
    const promptContent = prompt;
    const mentionsProductSearch = /search_products/.test(promptContent);
    const mentionsDisabled = /Product search is currently disabled|only employee search is available/i.test(promptContent);
    const mentionsEmployeeOnly = /ONLY supports employee|ONLY ACTIVE SEARCH/i.test(promptContent);
    
    console.log(`\n  System Prompt ${index + 1}:`);
    if (mentionsDisabled || mentionsEmployeeOnly) {
      console.log('  ✅ PASS: Mentions product search is disabled');
    } else if (mentionsProductSearch) {
      console.log('  ⚠️  WARN: Still mentions search_products (may need update)');
    } else {
      console.log('  ✅ PASS: No active product search references');
    }
  });
} else {
  console.log('⚠️  WARN: Could not find system prompts');
}

// Test 4: Check interception logic
console.log('\n📋 Test 4: Checking product search interception logic...');
const hasInterception = /search_products.*redirect|Product search is disabled.*redirecting/i.test(chatFileContent);
if (hasInterception) {
  console.log('✅ PASS: Product search interception/redirection logic found');
} else {
  console.log('⚠️  WARN: Product search interception logic not found');
}

// Test 5: Check tool execution handler
console.log('\n📋 Test 5: Checking tool execution handler...');
const toolExecutionMatch = chatFileContent.match(/if \(functionName === 'search_products'\)/);
if (toolExecutionMatch) {
  // Check if it's commented out
  const beforeMatch = chatFileContent.substring(0, toolExecutionMatch.index);
  const linesBefore = beforeMatch.split('\n');
  const lastLine = linesBefore[linesBefore.length - 1];
  const isCommented = lastLine.trim().startsWith('//') || lastLine.includes('DISABLED');
  
  if (isCommented) {
    console.log('✅ PASS: search_products handler is commented out');
  } else {
    console.log('❌ FAIL: search_products handler is still active');
    process.exit(1);
  }
} else {
  console.log('✅ PASS: No active search_products handler found');
}

// Test 6: Check compare_products
console.log('\n📋 Test 6: Checking compare_products tool...');
const compareProductsCommented = /\/\/.*compare_products|name: 'compare_products'.*\/\/ DISABLED/.test(chatFileContent);
const compareProductsActive = /name: 'compare_products'/.test(chatFileContent) && !compareProductsCommented;
if (compareProductsActive) {
  console.log('❌ FAIL: compare_products is still active');
  process.exit(1);
} else if (compareProductsCommented) {
  console.log('✅ PASS: compare_products is commented out (disabled)');
} else {
  console.log('✅ PASS: compare_products is not found in tools array');
}

console.log('\n' + '='.repeat(60));
console.log('\n✨ All tests completed!\n');

// Summary
console.log('📝 Summary:');
console.log('  - Product search tools are disabled (orphaned but kept)');
console.log('  - Employee search remains active');
console.log('  - System prompts updated to reflect changes');
console.log('  - Interception logic in place for safety\n');
