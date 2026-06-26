const cache = new Map();

const get = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiry && Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

const set = (key, value, ttlSeconds = 300) => {
  cache.set(key, {
    value,
    expiry: ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null
  });
};

const del = (key) => {
  cache.delete(key);
};

const clear = () => {
  cache.clear();
};

module.exports = { get, set, del, clear };
