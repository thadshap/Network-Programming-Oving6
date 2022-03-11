"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.onLogin = onLogin;
exports.onLogout = onLogout;
exports.resumeLogin = resumeLogin;

var _multiStorage = require("./multi-storage");

var multiStorage = _interopRequireWildcard(_multiStorage);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function onLogin(_ref) {
    var id = _ref.id,
        token = _ref.token;

    this.userId = id;
    this.loggedIn = true;
    return multiStorage.set(this.endpoint + "__login_token__", token).then(this.emit.bind(this, "loggedIn", id)).then(function () {
        return id;
    });
}

function onLogout() {
    this.userId = null;
    this.loggedIn = false;
    return multiStorage.del(this.endpoint + "__login_token__").then(this.emit.bind(this, "loggedOut")).then(function () {
        return null;
    });
}

function resumeLogin() {
    return multiStorage.get(this.endpoint + "__login_token__").then(function (resume) {
        if (!resume) {
            throw new Error("No login token");
        }
        return { resume: resume };
    }).then(this.login.bind(this)).catch(onLogout.bind(this));
}