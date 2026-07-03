const PREFIX = '[odin500-social]';

function fmt(scope, msg) {
  return scope ? `${PREFIX}[${scope}] ${msg}` : `${PREFIX} ${msg}`;
}

const log = {
  info(scope, msg, detail) {
    if (detail !== undefined) console.log(fmt(scope, msg), detail);
    else console.log(fmt(scope, msg));
  },
  warn(scope, msg, detail) {
    if (detail !== undefined) console.warn(fmt(scope, msg), detail);
    else console.warn(fmt(scope, msg));
  },
  error(scope, msg, detail) {
    if (detail !== undefined) console.error(fmt(scope, msg), detail);
    else console.error(fmt(scope, msg));
  }
};

module.exports = { log };
