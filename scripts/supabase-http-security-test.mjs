#!/usr/bin/env node

const required = [
  'SUPABASE_TEST_ENVIRONMENT',
  'SUPABASE_STAGING_URL',
  'SUPABASE_STAGING_ANON_KEY',
  'SUPABASE_TEST_USER_A_EMAIL',
  'SUPABASE_TEST_USER_A_PASSWORD',
  'SUPABASE_TEST_USER_B_EMAIL',
  'SUPABASE_TEST_USER_B_PASSWORD',
];

if (process.env.SUPABASE_TEST_ENVIRONMENT !== 'staging') {
  throw new Error('Refusing to run: SUPABASE_TEST_ENVIRONMENT must be exactly "staging".');
}

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const baseUrl = process.env.SUPABASE_STAGING_URL.replace(/\/+$/, '');
const anonKey = process.env.SUPABASE_STAGING_ANON_KEY;
const fixtures = {
  profileName: null,
  supermarketId: null,
  purchaseId: null,
  itemId: null,
  shoppingListId: null,
  shoppingListItemId: null,
};

const sessions = {};

const responseBody = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const apiRequest = async (path, { token, method = 'GET', body, headers = {}, expected } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      apikey: anonKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const parsed = await responseBody(response);

  if (expected && !expected.includes(response.status)) {
    throw new Error(`${method} ${path} returned ${response.status}: ${JSON.stringify(parsed)}`);
  }

  return { response, body: parsed };
};

const authenticate = async (email, password) => {
  const { response, body } = await apiRequest('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password },
    expected: [200],
  });

  if (!body?.access_token || !body?.user?.id) {
    throw new Error(`Auth response did not contain a session: ${response.status}`);
  }

  return { token: body.access_token, userId: body.user.id };
};

const rest = async (table, token, query, options = {}) => {
  const suffix = query ? `?${query}` : '';
  return apiRequest(`/rest/v1/${table}${suffix}`, { token, ...options });
};

const assertEmpty = (label, body) => {
  if (!Array.isArray(body) || body.length !== 0) {
    throw new Error(`${label}: expected an empty result, got ${JSON.stringify(body)}`);
  }
};

const assertUnchanged = (label, actual, expected) => {
  for (const [key, value] of Object.entries(expected)) {
    if (actual?.[key] !== value) {
      throw new Error(`${label}: field ${key} changed unexpectedly`);
    }
  }
};

const createFixtures = async () => {
  const b = sessions.b;
  const profile = await rest('profiles', b.token, `id=eq.${b.userId}&select=name`, {
    expected: [200],
  });
  if (!profile.body?.[0]) throw new Error('B profile fixture is missing');
  fixtures.profileName = profile.body[0].name;

  const createdSupermarket = await rest('supermarkets', b.token, '', {
    method: 'POST',
    body: { user_id: b.userId, name: 'HTTP security fixture', manual: true },
    headers: { Prefer: 'return=representation' },
    expected: [201],
  });
  fixtures.supermarketId = createdSupermarket.body[0].id;

  const createdPurchase = await rest('purchases', b.token, '', {
    method: 'POST',
    body: {
      user_id: b.userId,
      supermarket_id: fixtures.supermarketId,
      date: '2026-01-01',
      total_price: 20,
      manual: true,
    },
    headers: { Prefer: 'return=representation' },
    expected: [201],
  });
  fixtures.purchaseId = createdPurchase.body[0].id;

  const createdItem = await rest('items', b.token, '', {
    method: 'POST',
    body: {
      purchase_id: fixtures.purchaseId,
      name: 'HTTP security fixture item',
      quantity: 1,
      unit: 'UN',
      price: 20,
    },
    headers: { Prefer: 'return=representation' },
    expected: [201],
  });
  fixtures.itemId = createdItem.body[0].id;

  const createdList = await rest('shopping_lists', b.token, '', {
    method: 'POST',
    body: { user_id: b.userId, name: 'HTTP security fixture list', status: 'active' },
    headers: { Prefer: 'return=representation' },
    expected: [201],
  });
  fixtures.shoppingListId = createdList.body[0].id;

  const createdListItem = await rest('shopping_list_items', b.token, '', {
    method: 'POST',
    body: {
      shopping_list_id: fixtures.shoppingListId,
      name: 'HTTP security fixture list item',
      quantity: 1,
      unit: 'UN',
      estimated_price: 20,
    },
    headers: { Prefer: 'return=representation' },
    expected: [201],
  });
  fixtures.shoppingListItemId = createdListItem.body[0].id;
};

const assertReadIsolation = async () => {
  const a = sessions.a;
  const cases = [
    ['profiles', `id=eq.${sessions.b.userId}`],
    ['purchases', `id=eq.${fixtures.purchaseId}`],
    ['items', `id=eq.${fixtures.itemId}`],
    ['shopping_lists', `id=eq.${fixtures.shoppingListId}`],
    ['shopping_list_items', `id=eq.${fixtures.shoppingListItemId}`],
  ];

  for (const [table, query] of cases) {
    const result = await rest(table, a.token, query, { expected: [200] });
    assertEmpty(`A reading B's ${table}`, result.body);
  }
};

const assertWriteIsolation = async () => {
  const a = sessions.a;
  const cases = [
    ['profiles', `id=eq.${sessions.b.userId}`, { name: 'unexpected' }],
    ['purchases', `id=eq.${fixtures.purchaseId}`, { total_price: 999 }],
    ['items', `id=eq.${fixtures.itemId}`, { price: 999 }],
    ['shopping_lists', `id=eq.${fixtures.shoppingListId}`, { name: 'unexpected' }],
    ['shopping_list_items', `id=eq.${fixtures.shoppingListItemId}`, { name: 'unexpected' }],
  ];

  for (const [table, query, body] of cases) {
    const result = await rest(table, a.token, query, {
      method: 'PATCH',
      body,
      headers: { Prefer: 'return=representation' },
      expected: [200],
    });
    assertEmpty(`A updating B's ${table}`, result.body);
  }

  const b = sessions.b;
  const checks = [
    ['profiles', `id=eq.${b.userId}`, { name: fixtures.profileName }],
    ['purchases', `id=eq.${fixtures.purchaseId}`, { total_price: 20 }],
    ['items', `id=eq.${fixtures.itemId}`, { price: 20 }],
    ['shopping_lists', `id=eq.${fixtures.shoppingListId}`, { name: 'HTTP security fixture list' }],
    ['shopping_list_items', `id=eq.${fixtures.shoppingListItemId}`, { name: 'HTTP security fixture list item' }],
  ];

  for (const [table, query, expected] of checks) {
    const result = await rest(table, b.token, `${query}&select=*`, { expected: [200] });
    if (!result.body?.[0]) throw new Error(`B fixture disappeared from ${table}`);
    assertUnchanged(`B's ${table}`, result.body[0], expected);
  }
};

const assertDeleteIsolation = async () => {
  const a = sessions.a;
  const cases = [
    ['purchases', `id=eq.${fixtures.purchaseId}`],
    ['items', `id=eq.${fixtures.itemId}`],
    ['shopping_lists', `id=eq.${fixtures.shoppingListId}`],
    ['shopping_list_items', `id=eq.${fixtures.shoppingListItemId}`],
  ];

  for (const [table, query] of cases) {
    const result = await rest(table, a.token, query, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
      expected: [200],
    });
    assertEmpty(`A deleting B's ${table}`, result.body);
  }
};

const assertRpcIsolation = async () => {
  const result = await apiRequest('/rest/v1/rpc/create_purchase_with_items', {
    token: sessions.a.token,
    method: 'POST',
    body: {
      p_supermarket_id: fixtures.supermarketId,
      p_access_key: null,
      p_date: '2026-01-01',
      p_total_price: 1,
      p_manual: true,
      p_items: [],
    },
  });

  if (result.response.ok) {
    throw new Error('A RPC accepted a supermarket owned by B');
  }
};

const assertAnonymousDenial = async () => {
  for (const table of ['analytics_item_prices', 'analytics_market_baskets', 'analytics_price_trends', 'sensitive_access_audit']) {
    const result = await rest(table, null, 'select=*');
    if (![401, 403].includes(result.response.status)) {
      throw new Error(`anon access to ${table} returned ${result.response.status}`);
    }
  }
};

const cleanup = async () => {
  const b = sessions.b;
  if (!b) return;

  const cleanupCases = [
    ['shopping_list_items', `id=eq.${fixtures.shoppingListItemId}`],
    ['shopping_lists', `id=eq.${fixtures.shoppingListId}`],
    ['items', `id=eq.${fixtures.itemId}`],
    ['purchases', `id=eq.${fixtures.purchaseId}`],
    ['supermarkets', `id=eq.${fixtures.supermarketId}`],
  ];

  for (const [table, query] of cleanupCases) {
    if (!query.endsWith('null')) {
      await rest(table, b.token, query, { method: 'DELETE', expected: [204, 200] });
    }
  }
};

try {
  sessions.a = await authenticate(
    process.env.SUPABASE_TEST_USER_A_EMAIL,
    process.env.SUPABASE_TEST_USER_A_PASSWORD
  );
  sessions.b = await authenticate(
    process.env.SUPABASE_TEST_USER_B_EMAIL,
    process.env.SUPABASE_TEST_USER_B_PASSWORD
  );

  await createFixtures();
  await assertReadIsolation();
  await assertWriteIsolation();
  await assertDeleteIsolation();
  await assertRpcIsolation();
  await assertAnonymousDenial();
  console.log('Supabase staging HTTP security test passed.');
} finally {
  try {
    await cleanup();
  } catch (error) {
    console.error(`Fixture cleanup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
