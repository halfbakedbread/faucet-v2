const config = require('../config');
const xdai = require('../cryptos/xdai');

const faucet = require('../utils/faucet');
const format = require('../utils/format');
const captcha = require('../utils/captcha');

const faucet_name = config.name;
const faucet_address = config.xdai.address;

let ip_cache = {};
let private_key;

config.secrets.use_env ? (private_key = process.env.eth_privkey) : (private_key = config.secrets.eth_privkey);

xdai.set_rpc(config.xdai.rpc);
xdai.connect(private_key);

async function get_xdai(req, res, next) {
  try {
    // DRY
    res.locals.faucet_name = config.name.replace('<coin>', 'xDai');
    res.locals.faucet_address = faucet_address;
    res.locals.notice = config.notice;
    res.locals.sponsor = config.sponsor;
    res.locals.claim_time_str = format.milliseconds_to_readable(config.xdai.claim_frequency);
    res.locals.sitekey = config.captcha.hcaptcha_sitekey;
    res.locals.is_default = config.xdai.default;
    res.locals.logo = config.logo;
    res.locals.given = false;
    res.locals.errors = false;
    res.locals.coin = 'xdai';
    return res.render('xdai');
  } catch (error) {
    if (config.debug) console.log(error);
    return next(error);
  }
}

async function post_xdai(req, res, next) {
  try {
    let address = req.body.address;
    let errors = false;
    let given = false;
    let balance = false;
    let amount = false;

    // Check client IP address
    let ip = req.header('x-forwarded-for');
    if (ip_cache[ip] > 4) errors = 'Too many claims from this IP address.';

    // Check if faucet is dry
    if (await xdai.dry(config.xdai.address)) errors = 'Faucet dry.';

    // Check request procedence
    if (!captcha.came_from_site(req)) errors = 'Post request did not come from site';

    // Check captcha
    const check_captcha = await captcha.get_captcha_success(req.body);
    if (!check_captcha) errors = 'Failed or expired captcha.';

    // Check database
    const too_soon_db = await faucet.claim_too_soon_db(address, 'xdai');
    if (too_soon_db) errors = 'Last claim too soon.';

    //check cookies
    let too_soon_cookies = await faucet.claim_too_soon_cookies(req.cookies, 'xdai');
    if (too_soon_cookies) errors = 'Last claim too soon.';

    // Payouts
    let config_payouts = config.xdai.payouts;
    let payout = faucet.calculate_payouts(config_payouts);

    // Reduce payouts for suspicious accounts
    if (config.unopened_reduced_payouts && (await xdai.is_unopened(address))) {
      payout = config.xdai.payouts.min_payout * 0.5;
    }

    // Send xDai
    if (!errors) {
      let success = await xdai.send(address, payout);

      if (success) {
        given = true;
        amount = format.format_amount_decimals(payout);

        // Check faucet balance on success
        balance = xdai.check_bal(faucet_address);

        if (ip_cache[ip]) ip_cache[ip] = ip_cache[ip] + 1;
        else ip_cache[ip] = 1;

        await faucet.add_to_db(address, 'xdai');
        faucet.add_to_cookies(res, 'xdai');
      } else {
        errors = 'There was an error, try again later.';
      }
    }

    // DRY
    res.locals.faucet_name = faucet_name.replace('<coin>', 'xDai');
    res.locals.faucet_address = faucet_address;
    res.locals.current_bal = balance;
    res.locals.notice = config.notice;
    res.locals.sponsor = config.sponsor;
    res.locals.claim_time_str = format.milliseconds_to_readable(config.xdai.claim_frequency);
    res.locals.sitekey = config.captcha.hcaptcha_sitekey;
    res.locals.is_default = config.xdai.default;
    res.locals.logo = config.logo;
    res.locals.amount = amount;
    res.locals.given = given;
    res.locals.given_to = address;
    res.locals.errors = errors;
    res.locals.coin = 'xdai';
    return res.render('xdai');
  } catch (error) {
    if (config.debug) console.log(error);
    return next(error);
  }
}

module.exports = {
  get_xdai: get_xdai,
  post_xdai: post_xdai,
};
