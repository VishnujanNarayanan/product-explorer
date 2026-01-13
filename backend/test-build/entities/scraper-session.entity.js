"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperSession = void 0;
// backend/src/entities/scraper-session.entity.ts
const typeorm_1 = require("typeorm");
let ScraperSession = (() => {
    let _classDecorators = [(0, typeorm_1.Entity)('scraper_session')];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _id_decorators;
    let _id_initializers = [];
    let _id_extraInitializers = [];
    let _session_id_decorators;
    let _session_id_initializers = [];
    let _session_id_extraInitializers = [];
    let _user_id_decorators;
    let _user_id_initializers = [];
    let _user_id_extraInitializers = [];
    let _current_url_decorators;
    let _current_url_initializers = [];
    let _current_url_extraInitializers = [];
    let _browser_state_decorators;
    let _browser_state_initializers = [];
    let _browser_state_extraInitializers = [];
    let _created_at_decorators;
    let _created_at_initializers = [];
    let _created_at_extraInitializers = [];
    let _last_active_decorators;
    let _last_active_initializers = [];
    let _last_active_extraInitializers = [];
    let _status_decorators;
    let _status_initializers = [];
    let _status_extraInitializers = [];
    let _stats_decorators;
    let _stats_initializers = [];
    let _stats_extraInitializers = [];
    var ScraperSession = _classThis = class {
        constructor() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.session_id = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _session_id_initializers, void 0));
            this.user_id = (__runInitializers(this, _session_id_extraInitializers), __runInitializers(this, _user_id_initializers, void 0));
            this.current_url = (__runInitializers(this, _user_id_extraInitializers), __runInitializers(this, _current_url_initializers, void 0));
            this.browser_state = (__runInitializers(this, _current_url_extraInitializers), __runInitializers(this, _browser_state_initializers, void 0)); // Serialized browser state for restoration
            this.created_at = (__runInitializers(this, _browser_state_extraInitializers), __runInitializers(this, _created_at_initializers, void 0));
            this.last_active = (__runInitializers(this, _created_at_extraInitializers), __runInitializers(this, _last_active_initializers, void 0));
            this.status = (__runInitializers(this, _last_active_extraInitializers), __runInitializers(this, _status_initializers, void 0));
            this.stats = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _stats_initializers, void 0));
            __runInitializers(this, _stats_extraInitializers);
        }
    };
    __setFunctionName(_classThis, "ScraperSession");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)()];
        _session_id_decorators = [(0, typeorm_1.Column)({ unique: true })];
        _user_id_decorators = [(0, typeorm_1.Column)({ nullable: true })];
        _current_url_decorators = [(0, typeorm_1.Column)({ nullable: true })];
        _browser_state_decorators = [(0, typeorm_1.Column)('jsonb', { nullable: true })];
        _created_at_decorators = [(0, typeorm_1.Column)({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })];
        _last_active_decorators = [(0, typeorm_1.Column)({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })];
        _status_decorators = [(0, typeorm_1.Column)({ default: 'active' })];
        _stats_decorators = [(0, typeorm_1.Column)('jsonb', { nullable: true })];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: obj => "id" in obj, get: obj => obj.id, set: (obj, value) => { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _session_id_decorators, { kind: "field", name: "session_id", static: false, private: false, access: { has: obj => "session_id" in obj, get: obj => obj.session_id, set: (obj, value) => { obj.session_id = value; } }, metadata: _metadata }, _session_id_initializers, _session_id_extraInitializers);
        __esDecorate(null, null, _user_id_decorators, { kind: "field", name: "user_id", static: false, private: false, access: { has: obj => "user_id" in obj, get: obj => obj.user_id, set: (obj, value) => { obj.user_id = value; } }, metadata: _metadata }, _user_id_initializers, _user_id_extraInitializers);
        __esDecorate(null, null, _current_url_decorators, { kind: "field", name: "current_url", static: false, private: false, access: { has: obj => "current_url" in obj, get: obj => obj.current_url, set: (obj, value) => { obj.current_url = value; } }, metadata: _metadata }, _current_url_initializers, _current_url_extraInitializers);
        __esDecorate(null, null, _browser_state_decorators, { kind: "field", name: "browser_state", static: false, private: false, access: { has: obj => "browser_state" in obj, get: obj => obj.browser_state, set: (obj, value) => { obj.browser_state = value; } }, metadata: _metadata }, _browser_state_initializers, _browser_state_extraInitializers);
        __esDecorate(null, null, _created_at_decorators, { kind: "field", name: "created_at", static: false, private: false, access: { has: obj => "created_at" in obj, get: obj => obj.created_at, set: (obj, value) => { obj.created_at = value; } }, metadata: _metadata }, _created_at_initializers, _created_at_extraInitializers);
        __esDecorate(null, null, _last_active_decorators, { kind: "field", name: "last_active", static: false, private: false, access: { has: obj => "last_active" in obj, get: obj => obj.last_active, set: (obj, value) => { obj.last_active = value; } }, metadata: _metadata }, _last_active_initializers, _last_active_extraInitializers);
        __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: obj => "status" in obj, get: obj => obj.status, set: (obj, value) => { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
        __esDecorate(null, null, _stats_decorators, { kind: "field", name: "stats", static: false, private: false, access: { has: obj => "stats" in obj, get: obj => obj.stats, set: (obj, value) => { obj.stats = value; } }, metadata: _metadata }, _stats_initializers, _stats_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ScraperSession = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ScraperSession = _classThis;
})();
exports.ScraperSession = ScraperSession;
