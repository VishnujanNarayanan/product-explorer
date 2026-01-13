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
exports.Product = void 0;
const typeorm_1 = require("typeorm");
const category_entity_1 = require("./category.entity");
const product_detail_entity_1 = require("./product-detail.entity");
const review_entity_1 = require("./review.entity");
let Product = (() => {
    let _classDecorators = [(0, typeorm_1.Entity)('product')];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _id_decorators;
    let _id_initializers = [];
    let _id_extraInitializers = [];
    let _source_id_decorators;
    let _source_id_initializers = [];
    let _source_id_extraInitializers = [];
    let _title_decorators;
    let _title_initializers = [];
    let _title_extraInitializers = [];
    let _price_decorators;
    let _price_initializers = [];
    let _price_extraInitializers = [];
    let _currency_decorators;
    let _currency_initializers = [];
    let _currency_extraInitializers = [];
    let _image_url_decorators;
    let _image_url_initializers = [];
    let _image_url_extraInitializers = [];
    let _source_url_decorators;
    let _source_url_initializers = [];
    let _source_url_extraInitializers = [];
    let _last_scraped_at_decorators;
    let _last_scraped_at_initializers = [];
    let _last_scraped_at_extraInitializers = [];
    let _category_decorators;
    let _category_initializers = [];
    let _category_extraInitializers = [];
    let _detail_decorators;
    let _detail_initializers = [];
    let _detail_extraInitializers = [];
    let _reviews_decorators;
    let _reviews_initializers = [];
    let _reviews_extraInitializers = [];
    var Product = _classThis = class {
        constructor() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.source_id = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _source_id_initializers, void 0));
            this.title = (__runInitializers(this, _source_id_extraInitializers), __runInitializers(this, _title_initializers, void 0));
            this.price = (__runInitializers(this, _title_extraInitializers), __runInitializers(this, _price_initializers, void 0));
            this.currency = (__runInitializers(this, _price_extraInitializers), __runInitializers(this, _currency_initializers, void 0));
            this.image_url = (__runInitializers(this, _currency_extraInitializers), __runInitializers(this, _image_url_initializers, void 0));
            this.source_url = (__runInitializers(this, _image_url_extraInitializers), __runInitializers(this, _source_url_initializers, void 0));
            this.last_scraped_at = (__runInitializers(this, _source_url_extraInitializers), __runInitializers(this, _last_scraped_at_initializers, void 0));
            this.category = (__runInitializers(this, _last_scraped_at_extraInitializers), __runInitializers(this, _category_initializers, void 0));
            this.detail = (__runInitializers(this, _category_extraInitializers), __runInitializers(this, _detail_initializers, void 0));
            this.reviews = (__runInitializers(this, _detail_extraInitializers), __runInitializers(this, _reviews_initializers, void 0));
            __runInitializers(this, _reviews_extraInitializers);
        }
    };
    __setFunctionName(_classThis, "Product");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)()];
        _source_id_decorators = [(0, typeorm_1.Column)({ unique: true })];
        _title_decorators = [(0, typeorm_1.Column)()];
        _price_decorators = [(0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, nullable: true })];
        _currency_decorators = [(0, typeorm_1.Column)({ default: 'GBP' })];
        _image_url_decorators = [(0, typeorm_1.Column)()];
        _source_url_decorators = [(0, typeorm_1.Column)()];
        _last_scraped_at_decorators = [(0, typeorm_1.Column)({ name: 'last_scraped_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })];
        _category_decorators = [(0, typeorm_1.ManyToOne)(() => category_entity_1.Category, (category) => category.products), (0, typeorm_1.JoinColumn)({ name: 'category_id' })];
        _detail_decorators = [(0, typeorm_1.OneToOne)(() => product_detail_entity_1.ProductDetail, (detail) => detail.product)];
        _reviews_decorators = [(0, typeorm_1.OneToMany)(() => review_entity_1.Review, (review) => review.product)];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: obj => "id" in obj, get: obj => obj.id, set: (obj, value) => { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _source_id_decorators, { kind: "field", name: "source_id", static: false, private: false, access: { has: obj => "source_id" in obj, get: obj => obj.source_id, set: (obj, value) => { obj.source_id = value; } }, metadata: _metadata }, _source_id_initializers, _source_id_extraInitializers);
        __esDecorate(null, null, _title_decorators, { kind: "field", name: "title", static: false, private: false, access: { has: obj => "title" in obj, get: obj => obj.title, set: (obj, value) => { obj.title = value; } }, metadata: _metadata }, _title_initializers, _title_extraInitializers);
        __esDecorate(null, null, _price_decorators, { kind: "field", name: "price", static: false, private: false, access: { has: obj => "price" in obj, get: obj => obj.price, set: (obj, value) => { obj.price = value; } }, metadata: _metadata }, _price_initializers, _price_extraInitializers);
        __esDecorate(null, null, _currency_decorators, { kind: "field", name: "currency", static: false, private: false, access: { has: obj => "currency" in obj, get: obj => obj.currency, set: (obj, value) => { obj.currency = value; } }, metadata: _metadata }, _currency_initializers, _currency_extraInitializers);
        __esDecorate(null, null, _image_url_decorators, { kind: "field", name: "image_url", static: false, private: false, access: { has: obj => "image_url" in obj, get: obj => obj.image_url, set: (obj, value) => { obj.image_url = value; } }, metadata: _metadata }, _image_url_initializers, _image_url_extraInitializers);
        __esDecorate(null, null, _source_url_decorators, { kind: "field", name: "source_url", static: false, private: false, access: { has: obj => "source_url" in obj, get: obj => obj.source_url, set: (obj, value) => { obj.source_url = value; } }, metadata: _metadata }, _source_url_initializers, _source_url_extraInitializers);
        __esDecorate(null, null, _last_scraped_at_decorators, { kind: "field", name: "last_scraped_at", static: false, private: false, access: { has: obj => "last_scraped_at" in obj, get: obj => obj.last_scraped_at, set: (obj, value) => { obj.last_scraped_at = value; } }, metadata: _metadata }, _last_scraped_at_initializers, _last_scraped_at_extraInitializers);
        __esDecorate(null, null, _category_decorators, { kind: "field", name: "category", static: false, private: false, access: { has: obj => "category" in obj, get: obj => obj.category, set: (obj, value) => { obj.category = value; } }, metadata: _metadata }, _category_initializers, _category_extraInitializers);
        __esDecorate(null, null, _detail_decorators, { kind: "field", name: "detail", static: false, private: false, access: { has: obj => "detail" in obj, get: obj => obj.detail, set: (obj, value) => { obj.detail = value; } }, metadata: _metadata }, _detail_initializers, _detail_extraInitializers);
        __esDecorate(null, null, _reviews_decorators, { kind: "field", name: "reviews", static: false, private: false, access: { has: obj => "reviews" in obj, get: obj => obj.reviews, set: (obj, value) => { obj.reviews = value; } }, metadata: _metadata }, _reviews_initializers, _reviews_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Product = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Product = _classThis;
})();
exports.Product = Product;
