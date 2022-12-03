// Default expiration time of the cached tokens
const ONE_WEEK_MILLISECONDS = 1000 * 60 * 60 * 24 * 7;

function options_builder(options) {
  // Required
  if (!('protected_paths' in options)) throw new Error('Protected path array is missing');

  // Optional
  if (!('debug' in options)) options.debug = false;
  if (!('captcha_provider_url' in options)) options.captcha_provider_url = 'https://captcha.prussia.dev';
  if (!('captcha_title' in options)) options.captcha_title = 'Captcha';
  if (!('expiration_time' in options)) options.expiration_time = ONE_WEEK_MILLISECONDS;

  return options;
}

// Signing the cookie might be enough but we still want to compare it against our stored cookie data
function cookie_expired(timestamp) {
  if (!isNaN(timestamp) && Date.now() > timestamp + ONE_WEEK_MILLISECONDS) return true;
  else return false;
}

// The token is the nonce generated by the Prussia Captcha Server stored alongside a timestamp in the browser cookies
function check_cookie(cookie, cache_set) {
  if (cookie) {
    for (const [key, value] of cache_set.entries()) {
      if (value.token === cookie?.token && !cookie_expired(value.timestamp)) return true;
    }
    return false;
  } else {
    return false;
  }
}

module.exports = {
  options_builder: options_builder,
  check_cookie: check_cookie,
};
