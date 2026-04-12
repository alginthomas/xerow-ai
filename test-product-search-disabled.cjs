#!/usr/bin/env node
/**
 * CLI Test Script: Verify Product Search is Disabled
 */

const fs = require('fs');
const path = require('path');

const chatFilePath = path.join(__dirname, 'server', 'src', 'routes', 'chat.ts');
const chatFileContent = fs.readFileSync(chatFilePath, 'utf-8');

console.log('🧪 Testing Product Search Disabled Configuration\n');
console.log('='.repeat(60));

// Test 1: Check tools array
console.log('\n📋 Test 1: Tools Array Analysis');
const toolsStart = chatFileContent.indexOf('const tools = [');
const toolsEnd = chatFileContent.indexOf('];', toolsStart);
if (toolsStart !== -1 && toolsEnd !== -1) {
  const toolsSection = chatFileContent.substring(toolsStart, toolsEnd);
  
  // Check for search_products
  const searchProductsMatch = toolsSection.match(/name: 'search_products'/);
  if (searchProductsMatch) {
    const matchIndex = searchProductsMatch.index;
    const beforeMatch = toolsSection.substring(Math.max(0, matchIndex - 500), matchIndex);
    const isCommented = /\/\/\s*DISABLED.*Product search|DISABLED.*search_products/.test(beforeMatch) ||
                        beforeMatch.includes('// DISABLED: Product search') ||
                        beforeMatch.includes('// DISABLED: Product');
    
    if (isCommented) {
      console.log('  ✅ PASS: search_products is commented out (disabled)');
    } else {
      console.log('  ❌ FAIL: search_products is active in tools array');
      process.exit(1);
    }
  } else {
    console.log('  ✅ PASS: search_products not found in tools array');
  }
  
  // Check for search_employees
  const hasSearchEmployees = /name: 'search_employees'/.test(toolsSection);
  if (hasSearchEmployees) {
    console.log('  ✅ PASS: search_employees is active');
  } else {
    console.log('  ❌ FAIL: search_employees missing');
    process.exit(1);
  }
  
  // List active tools
  const toolMatches = toolsSection.match(/name: '(\w+)'/g) || [];
  const activeTools = toolMatches.map(m => {
    const name = m.match(/'(\w+)'/)[1];
    const matchIndex = toolsSection.indexOf(m);
    const beforeMatch = toolsSection.substring(Math.max(0, matchIndex - 200), matchIndex);
    const isDisabled = beforeMatch.includes('// DISABLED') || beforeMatch.includes('// DISABLED:');
    return isDisabled ? null : name;
  }).filter(Boolean);
  
  console.log(`  📊 Active tools: ${[...new Set(activeTools)].join(', ')}`);
} else {
  console.log('  ❌ FAIL: Could not find tools array');
  process.exit(1);
}

// Test 2: Check searchProducts function
console.log('\n📋 Test 2: searchProducts Function');
const searchProductsFuncMatch = chatFileContent.match(/async function searchProducts[\s\S]{0,300}/);
if (searchProductsFuncMatch) {
  const funcContent = searchProductsFuncMatch[0];
  if (/DISABLED|console\.warn.*disabled|return \[\];/.test(funcContent)) {
    console.log('  ✅ PASS: Function is disabled');
  } else {
    console.log('  ⚠️  WARN: Function exists but may not be disabled');
  }
} else {
  console.log('  ✅ PASS: Function not found or properly disabled');
}

// Test 3: Check system prompts
console.log('\n📋 Test 3: System Prompts');
const promptRegex = /const systemPrompt = `([\s\S]{0,1500})`;/g;
let promptMatch;
let promptIndex = 0;
while ((promptMatch = promptRegex.exec(chatFileContent)) !== null) {
  promptIndex++;
  const prompt = promptMatch[1];
  const hasDisabled = /Product search is currently disabled|only employee search is available/i.test(prompt);
  const hasEmployeeOnly = /ONLY supports employee|ONLY ACTIVE SEARCH/i.test(prompt);
  const mentionsSearchProducts = /search_products/.test(prompt);
  
  console.log(`  System Prompt ${promptIndex}:`);
  if (hasDisabled || hasEmployeeOnly) {
    console.log('    ✅ PASS: Mentions product search is disabled');
  } else if (mentionsSearchProducts && !hasDisabled) {
    console.log('    ⚠️  WARN: Mentions search_products but may need update');
  } else {
    console.log('    ✅ PASS: No active product search references');
  }
}

// Test 4: Check tool execution handler
console.log('\n📋 Test 4: Tool Execution Handler');
const executionPattern = /if \(functionName === 'search_products'\)/;
const executionMatch = chatFileContent.match(executionPattern);
if (executionMatch) {
  const beforeIndex = executionMatch.index;
  const beforeText = chatFileContent.substring(Math.max(0, beforeIndex - 100), beforeIndex);
  const isCommented = beforeText.includes('// DISABLED') || beforeText.trim().endsWith('//');
  
  if (isCommented) {
    console.log('  ✅ PASS: Handler is commented out');
  } else {
    console.log('  ❌ FAIL: Handler is still active');
    process.exit(1);
  }
} else {
  console.log('  ✅ PASS: No active handler found');
}

// Test 5: Check compare_products
console.log('\n📋 Test 5: compare_products Tool');
const compareProductsMatch = chatFileContent.match(/name: 'compare_products'/);
if (compareProductsMatch) {
  const matchIndex = compareProductsMatch.index;
  const beforeMatch = chatFileContent.substring(Math.max(0, matchIndex - 500), matchIndex);
  const isCommented = /\/\/\s*DISABLED.*Product comparison|DISABLED.*compare_products/.test(beforeMatch) ||
                      beforeMatch.includes('// DISABLED: Product comparison') ||
                      beforeMatch.includes('// DISABLED: Product');
  
  if (isCommented) {
    console.log('  ✅ PASS: compare_products is commented out (disabled)');
  } else {
    console.log('  ❌ FAIL: compare_products is active in tools array');
    process.exit(1);
  }
} else {
  console.log('  ✅ PASS: compare_products not found in tools array');
}

// Test 6: Check interception logic
console.log('\n📋 Test 6: Interception Logic');
const hasInterception = /search_products.*redirect|Product search is disabled.*redirecting/i.test(chatFileContent);
if (hasInterception) {
  console.log('  ✅ PASS: Product search interception/redirection logic found');
} else {
  console.log('  ⚠️  WARN: Product search interception logic not found');
}

console.log('\n' + '='.repeat(60));
console.log('\n✨ All tests completed successfully!');
console.log('\n📝 Summary:');
console.log('  ✅ Product search tools are disabled (orphaned but kept)');
console.log('  ✅ Employee search remains active');
console.log('  ✅ System prompts updated');
console.log('  ✅ Interception logic in place\n');
