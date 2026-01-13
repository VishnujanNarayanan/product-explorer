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
exports.ProductDetail = void 0;
const typeorm_1 = require("typeorm");
const product_entity_1 = require("./product.entity");
let ProductDetail = (() => {
    let _classDecorators = [(0, typeorm_1.Entity)('product_detail')];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _product_id_decorators;
    let _product_id_initializers = [];
    let _product_id_extraInitializers = [];
    let _description_decorators;
    let _description_initializers = [];
    let _description_extraInitializers = [];
    let _specs_decorators;
    let _specs_initializers = [];
    let _specs_extraInitializers = [];
    let _ratings_avg_decorators;
    let _ratings_avg_initializers = [];
    let _ratings_avg_extraInitializers = [];
    let _reviews_count_decorators;
    let _reviews_count_initializers = [];
    let _reviews_count_extraInitializers = [];
    let _product_decorators;
    let _product_initializers = [];
    let _product_extraInitializers = [];
    var ProductDetail = _classThis = class {
        constructor() {
            this.product_id = __runInitializers(this, _product_id_initializers, void 0);
            this.description = (__runInitializers(this, _product_id_extraInitializers), __runInitializers(this, _description_initializers, void 0));
            this.specs = (__runInitializers(this, _description_extraInitializers), __runInitializers(this, _specs_initializers, void 0));
            this.ratings_avg = (__runInitializers(this, _specs_extraInitializers), __runInitializers(this, _ratings_avg_initializers, void 0));
            this.reviews_count = (__runInitializers(this, _ratings_avg_extraInitializers), __runInitializers(this, _reviews_count_initializers, void 0));
            this.product = (__runInitializers(this, _reviews_count_extraInitializers), __runInitializers(this, _product_initializers, void 0));
            __runInitializers(this, _product_extraInitializers);
        }
    };
    __setFunctionName(_classThis, "ProductDetail");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _product_id_decorators = [(0, typeorm_1.PrimaryColumn)({ name: 'product_id' })];
        _description_decorators = [(0, typeorm_1.Column)('text')];
        _specs_decorators = [(0, typeorm_1.Column)('jsonb', { nullable: true })];
        _ratings_avg_decorators = [(0, typeorm_1.Column)('decimal', { precision: 3, scale: 2, nullable: true })];
        _reviews_count_decorators = [(0, typeorm_1.Column)({ name: 'reviews_count', default: 0 })];
        _product_decorators = [(0, typeorm_1.OneToOne)(() => product_entity_1.Product, (product) => product.detail), (0, typeorm_1.JoinColumn)({ name: 'product_id' })];
        __esDecorate(null, null, _product_id_decorators, { kind: "field", name: "product_id", static: false, private: false, access: { has: obj => "product_id" in obj, get: obj => obj.product_id, set: (obj, value) => { obj.product_id = value; } }, metadata: _metadata }, _product_id_initializers, _product_id_extraInitializers);
        __esDecorate(null, null, _description_decorators, { kind: "field", name: "description", static: false, private: false, access: { has: obj => "description" in obj, get: obj => obj.description, set: (obj, value) => { obj.description = value; } }, metadata: _metadata }, _description_initializers, _description_extraInitializers);
        __esDecorate(null, null, _specs_decorators, { kind: "field", name: "specs", static: false, private: false, access: { has: obj => "specs" in obj, get: obj => obj.specs, set: (obj, value) => { obj.specs = value; } }, metadata: _metadata }, _specs_initializers, _specs_extraInitializers);
        __esDecorate(null, null, _ratings_avg_decorators, { kind: "field", name: "ratings_avg", static: false, private: false, access: { has: obj => "ratings_avg" in obj, get: obj => obj.ratings_avg, set: (obj, value) => { obj.ratings_avg = value; } }, metadata: _metadata }, _ratings_avg_initializers, _ratings_avg_extraInitializers);
        __esDecorate(null, null, _reviews_count_decorators, { kind: "field", name: "reviews_count", static: false, private: false, access: { has: obj => "reviews_count" in obj, get: obj => obj.reviews_count, set: (obj, value) => { obj.reviews_count = value; } }, metadata: _metadata }, _reviews_count_initializers, _reviews_count_extraInitializers);
        __esDecorate(null, null, _product_decorators, { kind: "field", name: "product", static: false, private: false, access: { has: obj => "product" in obj, get: obj => obj.product, set: (obj, value) => { obj.product = value; } }, metadata: _metadata }, _product_initializers, _product_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ProductDetail = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ProductDetail = _classThis;
})();
exports.ProductDetail = ProductDetail;
