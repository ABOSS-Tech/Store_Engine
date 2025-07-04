import { createCartCreditLinesWorkflow } from "@medusajs/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  Modules,
  PriceListStatus,
  PriceListType,
  PromotionRuleOperator,
  PromotionStatus,
  PromotionType,
} from "@medusajs/utils"
import {
  createAdminUser,
  generatePublishableKey,
  generateStoreHeaders,
} from "../../../../helpers/create-admin-user"
import { setupTaxStructure } from "../../../../modules/__tests__/fixtures"
import { createAuthenticatedCustomer } from "../../../../modules/helpers/create-authenticated-customer"
import { medusaTshirtProduct } from "../../../__fixtures__/product"

jest.setTimeout(100000)

const env = { MEDUSA_FF_MEDUSA_V2: true }
const adminHeaders = { headers: { "x-medusa-access-token": "test_token" } }

const shippingAddressData = {
  address_1: "test address 1",
  address_2: "test address 2",
  city: "SF",
  country_code: "US",
  province: "CA",
  postal_code: "94016",
}

medusaIntegrationTestRunner({
  env,
  testSuite: ({ dbConnection, getContainer, api }) => {
    describe("Store Carts API", () => {
      let appContainer
      let storeHeaders
      let storeHeadersWithCustomer
      let region,
        noAutomaticRegion,
        product,
        salesChannel,
        cart,
        customer,
        promotion,
        shippingProfile

      beforeAll(async () => {
        appContainer = getContainer()
      })

      beforeEach(async () => {
        await createAdminUser(dbConnection, adminHeaders, appContainer)
        const publishableKey = await generatePublishableKey(appContainer)
        storeHeaders = generateStoreHeaders({ publishableKey })

        const result = await createAuthenticatedCustomer(api, storeHeaders, {
          first_name: "tony",
          last_name: "stark",
          email: "tony@stark-industries.com",
        })

        customer = result.customer
        storeHeadersWithCustomer = {
          headers: {
            ...storeHeaders.headers,
            authorization: `Bearer ${result.jwt}`,
          },
        }

        shippingProfile = (
          await api.post(
            `/admin/shipping-profiles`,
            { name: "default", type: "default" },
            adminHeaders
          )
        ).data.shipping_profile

        await setupTaxStructure(appContainer.resolve(Modules.TAX))

        region = (
          await api.post(
            "/admin/regions",
            { name: "US", currency_code: "usd", countries: ["us"] },
            adminHeaders
          )
        ).data.region

        noAutomaticRegion = (
          await api.post(
            "/admin/regions",
            { name: "EUR", currency_code: "eur", automatic_taxes: false },
            adminHeaders
          )
        ).data.region

        product = (
          await api.post(
            "/admin/products",
            { ...medusaTshirtProduct, shipping_profile_id: shippingProfile.id },
            adminHeaders
          )
        ).data.product

        salesChannel = (
          await api.post(
            "/admin/sales-channels",
            { name: "Webshop", description: "channel" },
            adminHeaders
          )
        ).data.sales_channel

        await api.post(
          "/admin/price-preferences",
          {
            attribute: "currency_code",
            value: "usd",
            is_tax_inclusive: true,
          },
          adminHeaders
        )

        promotion = (
          await api.post(
            `/admin/promotions`,
            {
              code: "PROMOTION_APPLIED",
              type: PromotionType.STANDARD,
              status: PromotionStatus.ACTIVE,
              application_method: {
                type: "fixed",
                target_type: "items",
                allocation: "each",
                value: 100,
                max_quantity: 1,
                currency_code: "usd",
                target_rules: [
                  {
                    attribute: "product_id",
                    operator: "in",
                    values: [product.id],
                  },
                ],
              },
            },
            adminHeaders
          )
        ).data.promotion
      })

      describe("POST /store/carts", () => {
        it("should successfully create a cart", async () => {
          const response = await api.post(
            `/store/carts`,
            {
              currency_code: "usd",
              sales_channel_id: salesChannel.id,
              region_id: region.id,
              shipping_address: shippingAddressData,
              items: [{ variant_id: product.variants[0].id, quantity: 1 }],
            },
            storeHeadersWithCustomer
          )

          expect(response.status).toEqual(200)
          expect(response.data.cart).toEqual(
            expect.objectContaining({
              currency_code: "usd",
              items: expect.arrayContaining([
                expect.objectContaining({
                  unit_price: 1500,
                  compare_at_unit_price: null,
                  is_tax_inclusive: true,
                  quantity: 1,
                  tax_lines: [
                    expect.objectContaining({
                      description: "CA Default Rate",
                      code: "CADEFAULT",
                      rate: 5,
                      provider_id: "system",
                    }),
                  ],
                  adjustments: [],
                }),
              ]),
            })
          )
        })

        describe("with sale price lists", () => {
          let priceList

          beforeEach(async () => {
            priceList = (
              await api.post(
                `/admin/price-lists`,
                {
                  title: "test price list",
                  description: "test",
                  status: PriceListStatus.ACTIVE,
                  type: PriceListType.SALE,
                  prices: [
                    {
                      amount: 350,
                      currency_code: "usd",
                      variant_id: product.variants[0].id,
                    },
                  ],
                },
                adminHeaders
              )
            ).data.price_list
          })

          it("should successfully create cart with price from price list", async () => {
            const response = await api.post(
              `/store/carts`,
              {
                currency_code: "usd",
                sales_channel_id: salesChannel.id,
                region_id: region.id,
                shipping_address: shippingAddressData,
                items: [{ variant_id: product.variants[0].id, quantity: 1 }],
              },
              storeHeaders
            )

            expect(response.status).toEqual(200)
            expect(response.data.cart).toEqual(
              expect.objectContaining({
                currency_code: "usd",
                items: expect.arrayContaining([
                  expect.objectContaining({
                    unit_price: 350,
                    compare_at_unit_price: 1500,
                    is_tax_inclusive: true,
                    quantity: 1,
                    tax_lines: [
                      expect.objectContaining({
                        description: "CA Default Rate",
                        code: "CADEFAULT",
                        rate: 5,
                        provider_id: "system",
                      }),
                    ],
                    adjustments: [],
                  }),
                ]),
              })
            )
          })
        })
      })

      describe("POST /store/carts/:id/line-items", () => {
        let shippingOption, shippingOptionExpensive, stockLocation

        beforeEach(async () => {
          stockLocation = (
            await api.post(
              `/admin/stock-locations`,
              { name: "test location" },
              adminHeaders
            )
          ).data.stock_location

          await api.post(
            `/admin/stock-locations/${stockLocation.id}/sales-channels`,
            { add: [salesChannel.id] },
            adminHeaders
          )

          const shippingProfile = (
            await api.post(
              `/admin/shipping-profiles`,
              { name: `test-${stockLocation.id}`, type: "default" },
              adminHeaders
            )
          ).data.shipping_profile

          const fulfillmentSets = (
            await api.post(
              `/admin/stock-locations/${stockLocation.id}/fulfillment-sets?fields=*fulfillment_sets`,
              {
                name: `Test-${shippingProfile.id}`,
                type: "test-type",
              },
              adminHeaders
            )
          ).data.stock_location.fulfillment_sets

          const fulfillmentSet = (
            await api.post(
              `/admin/fulfillment-sets/${fulfillmentSets[0].id}/service-zones`,
              {
                name: `Test-${shippingProfile.id}`,
                geo_zones: [
                  { type: "country", country_code: "it" },
                  { type: "country", country_code: "us" },
                ],
              },
              adminHeaders
            )
          ).data.fulfillment_set

          await api.post(
            `/admin/stock-locations/${stockLocation.id}/fulfillment-providers`,
            { add: ["manual_test-provider"] },
            adminHeaders
          )

          const shippingOptionPayload = {
            name: `Shipping`,
            service_zone_id: fulfillmentSet.service_zones[0].id,
            shipping_profile_id: shippingProfile.id,
            provider_id: "manual_test-provider",
            price_type: "flat",
            type: {
              label: "Test type",
              description: "Test description",
              code: "test-code",
            },
            prices: [
              { currency_code: "usd", amount: 1000 },
              {
                currency_code: "usd",
                amount: 0,
                rules: [
                  {
                    attribute: "item_total",
                    operator: "gt",
                    value: 5000,
                  },
                ],
              },
            ],
            rules: [
              {
                attribute: "enabled_in_store",
                value: "true",
                operator: "eq",
              },
              {
                attribute: "is_return",
                value: "false",
                operator: "eq",
              },
            ],
          }

          shippingOption = (
            await api.post(
              `/admin/shipping-options`,
              shippingOptionPayload,
              adminHeaders
            )
          ).data.shipping_option

          shippingOptionExpensive = (
            await api.post(
              `/admin/shipping-options`,
              {
                ...shippingOptionPayload,
                prices: [
                  { currency_code: "usd", amount: 10000 },
                  {
                    currency_code: "usd",
                    amount: 5000,
                    rules: [
                      {
                        attribute: "item_total",
                        operator: "gt",
                        value: 5000,
                      },
                    ],
                  },
                ],
              },
              adminHeaders
            )
          ).data.shipping_option

          cart = (
            await api.post(
              `/store/carts`,
              {
                currency_code: "usd",
                sales_channel_id: salesChannel.id,
                region_id: region.id,
                shipping_address: shippingAddressData,
                items: [{ variant_id: product.variants[0].id, quantity: 1 }],
                promo_codes: [promotion.code],
              },
              storeHeaders
            )
          ).data.cart
        })

        it("should add item to cart", async () => {
          let response = await api.post(
            `/store/carts/${cart.id}/line-items`,
            {
              variant_id: product.variants[0].id,
              quantity: 1,
            },
            storeHeaders
          )

          expect(response.status).toEqual(200)
          expect(response.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              currency_code: "usd",
              items: expect.arrayContaining([
                expect.objectContaining({
                  unit_price: 1500,
                  compare_at_unit_price: null,
                  is_tax_inclusive: true,
                  quantity: 2,
                  tax_lines: [
                    expect.objectContaining({
                      description: "CA Default Rate",
                      code: "CADEFAULT",
                      rate: 5,
                      provider_id: "system",
                    }),
                  ],
                  adjustments: [
                    {
                      id: expect.any(String),
                      code: "PROMOTION_APPLIED",
                      promotion_id: promotion.id,
                      amount: 100,
                    },
                  ],
                }),
              ]),
            })
          )
        })

        it("should remove promotions when promotion is no longer in active state", async () => {
          let responseBeforePromotionUpdate = await api.post(
            `/store/carts/${cart.id}/line-items`,
            {
              variant_id: product.variants[0].id,
              quantity: 1,
            },
            storeHeaders
          )

          expect(responseBeforePromotionUpdate.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              items: expect.arrayContaining([
                expect.objectContaining({
                  adjustments: [
                    {
                      id: expect.any(String),
                      code: "PROMOTION_APPLIED",
                      promotion_id: promotion.id,
                      amount: 100,
                    },
                  ],
                }),
              ]),
            })
          )

          await api.post(
            `/admin/promotions/${promotion.id}`,
            { status: PromotionStatus.INACTIVE },
            adminHeaders
          )

          let responseAfterPromotionUpdate = await api.post(
            `/store/carts/${cart.id}/line-items`,
            {
              variant_id: product.variants[0].id,
              quantity: 1,
            },
            storeHeaders
          )

          expect(responseAfterPromotionUpdate.status).toEqual(200)
          expect(responseAfterPromotionUpdate.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              items: expect.arrayContaining([
                expect.objectContaining({
                  adjustments: [],
                }),
                expect.objectContaining({
                  adjustments: [],
                }),
              ]),
            })
          )
        })

        describe("with custom shipping options prices", () => {
          beforeEach(async () => {
            cart = (
              await api.post(
                `/store/carts`,
                {
                  currency_code: "usd",
                  sales_channel_id: salesChannel.id,
                  region_id: region.id,
                  items: [{ variant_id: product.variants[0].id, quantity: 1 }],
                  promo_codes: [promotion.code],
                },
                storeHeadersWithCustomer
              )
            ).data.cart
          })

          it("should update shipping method amount when cart totals change", async () => {
            let response = await api.post(
              `/store/carts/${cart.id}/shipping-methods`,
              { option_id: shippingOption.id },
              storeHeaders
            )

            expect(response.data.cart).toEqual(
              expect.objectContaining({
                id: cart.id,
                shipping_methods: expect.arrayContaining([
                  expect.objectContaining({
                    shipping_option_id: shippingOption.id,
                    amount: 1000,
                    is_tax_inclusive: true,
                  }),
                ]),
              })
            )

            response = await api.post(
              `/store/carts/${cart.id}/line-items`,
              {
                variant_id: product.variants[0].id,
                quantity: 100,
              },
              storeHeaders
            )

            expect(response.data.cart).toEqual(
              expect.objectContaining({
                id: cart.id,
                shipping_methods: expect.arrayContaining([
                  expect.objectContaining({
                    shipping_option_id: shippingOption.id,
                    amount: 0,
                    is_tax_inclusive: true,
                  }),
                ]),
              })
            )
          })

          it("should remove shipping methods when they are no longer valid for the cart", async () => {
            let response = await api.post(
              `/store/carts/${cart.id}/shipping-methods`,
              { option_id: shippingOption.id },
              storeHeaders
            )

            expect(response.data.cart).toEqual(
              expect.objectContaining({
                id: cart.id,
                shipping_methods: expect.arrayContaining([
                  expect.objectContaining({
                    shipping_option_id: shippingOption.id,
                    amount: 1000,
                    is_tax_inclusive: true,
                  }),
                ]),
              })
            )

            response = await api.post(
              `/store/carts/${cart.id}`,
              { region_id: noAutomaticRegion.id },
              storeHeaders
            )

            expect(response.data.cart).toEqual(
              expect.objectContaining({
                id: cart.id,
                shipping_methods: expect.arrayContaining([]),
              })
            )
          })

          it("should update payment collection upon changing shipping option", async () => {
            await api.post(
              `/store/carts/${cart.id}/shipping-methods`,
              { option_id: shippingOption.id },
              storeHeaders
            )

            await api.post(
              `/store/payment-collections`,
              { cart_id: cart.id },
              storeHeaders
            )

            const cartAfterCollection = (
              await api.get(`/store/carts/${cart.id}`, storeHeaders)
            ).data.cart

            expect(cartAfterCollection).toEqual(
              expect.objectContaining({
                id: cart.id,
                shipping_methods: expect.arrayContaining([
                  expect.objectContaining({
                    shipping_option_id: shippingOption.id,
                  }),
                ]),
                payment_collection: expect.objectContaining({
                  amount: 2398,
                }),
              })
            )

            await api.post(
              `/store/carts/${cart.id}/line-items`,
              {
                variant_id: product.variants[0].id,
                quantity: 100,
              },
              storeHeaders
            )

            let cartAfterExpensiveShipping = (
              await api.post(
                `/store/carts/${cart.id}/shipping-methods`,
                { option_id: shippingOptionExpensive.id },
                storeHeaders
              )
            ).data.cart

            expect(cartAfterExpensiveShipping).toEqual(
              expect.objectContaining({
                id: cartAfterExpensiveShipping.id,
                shipping_methods: expect.arrayContaining([
                  expect.objectContaining({
                    shipping_option_id: shippingOptionExpensive.id,
                    amount: 5000,
                  }),
                ]),
                payment_collection: expect.objectContaining({
                  amount: 156398,
                }),
              })
            )
          })
        })

        it("should add item to cart with tax lines multiple times", async () => {
          let response = await api.post(
            `/store/carts/${cart.id}/line-items`,
            {
              variant_id: product.variants[0].id,
              quantity: 1,
            },
            storeHeaders
          )

          expect(response.status).toEqual(200)
          expect(response.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              currency_code: "usd",
              items: expect.arrayContaining([
                expect.objectContaining({
                  unit_price: 1500,
                  compare_at_unit_price: null,
                  is_tax_inclusive: true,
                  title: "Medusa T-Shirt",
                  quantity: 2,
                  tax_lines: [
                    expect.objectContaining({
                      description: "CA Default Rate",
                      code: "CADEFAULT",
                      rate: 5,
                      provider_id: "system",
                    }),
                  ],
                }),
              ]),
            })
          )

          response = await api.post(
            `/store/carts/${cart.id}/line-items`,
            {
              variant_id: product.variants[1].id,
              quantity: 1,
            },
            storeHeaders
          )

          expect(response.status).toEqual(200)
          expect(response.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              currency_code: "usd",
              items: expect.arrayContaining([
                expect.objectContaining({
                  unit_price: 1500,
                  compare_at_unit_price: null,
                  is_tax_inclusive: true,
                  quantity: 2,
                  title: "Medusa T-Shirt",
                  tax_lines: [
                    expect.objectContaining({
                      description: "CA Default Rate",
                      code: "CADEFAULT",
                      rate: 5,
                      provider_id: "system",
                    }),
                  ],
                }),
                expect.objectContaining({
                  unit_price: 1500,
                  compare_at_unit_price: null,
                  is_tax_inclusive: true,
                  quantity: 1,
                  title: "Medusa T-Shirt",
                  tax_lines: [
                    expect.objectContaining({
                      description: "CA Default Rate",
                      code: "CADEFAULT",
                      rate: 5,
                      provider_id: "system",
                    }),
                  ],
                }),
              ]),
            })
          )
        })

        describe("with sale price lists", () => {
          beforeEach(async () => {
            await api.post(
              `/admin/price-lists`,
              {
                title: "test price list",
                description: "test",
                status: PriceListStatus.ACTIVE,
                type: PriceListType.SALE,
                prices: [
                  {
                    amount: 350,
                    currency_code: "usd",
                    variant_id: product.variants[0].id,
                  },
                ],
              },
              adminHeaders
            )

            const customerGroup = (
              await api.post(
                "/admin/customer-groups",
                { name: "VIP" },
                adminHeaders
              )
            ).data.customer_group

            await api.post(
              `/admin/customer-groups/${customerGroup.id}/customers`,
              {
                add: [customer.id],
              },
              adminHeaders
            )

            await api.post(
              `/admin/price-lists`,
              {
                title: "test price list",
                description: "test",
                status: PriceListStatus.ACTIVE,
                type: PriceListType.SALE,
                prices: [
                  {
                    amount: 200,
                    currency_code: "usd",
                    variant_id: product.variants[0].id,
                  },
                ],
                rules: {
                  "customer.groups.id": [customerGroup.id],
                },
              },
              adminHeaders
            )
          })

          it("should add price from price list and set compare_at_unit_price", async () => {
            let response = await api.post(
              `/store/carts/${cart.id}/line-items`,
              {
                variant_id: product.variants[0].id,
                quantity: 1,
              },
              storeHeaders
            )

            expect(response.status).toEqual(200)
            expect(response.data.cart).toEqual(
              expect.objectContaining({
                id: cart.id,
                currency_code: "usd",
                items: expect.arrayContaining([
                  expect.objectContaining({
                    unit_price: 350,
                    compare_at_unit_price: 1500,
                    is_tax_inclusive: true,
                    quantity: 2,
                    tax_lines: [
                      expect.objectContaining({
                        description: "CA Default Rate",
                        code: "CADEFAULT",
                        rate: 5,
                        provider_id: "system",
                      }),
                    ],
                    adjustments: [
                      {
                        id: expect.any(String),
                        code: "PROMOTION_APPLIED",
                        promotion_id: promotion.id,
                        amount: 100,
                      },
                    ],
                  }),
                ]),
              })
            )
          })

          it("should add price from price list associated to a customer group when customer rules match", async () => {
            const transferredCart = (
              await api.post(
                `/store/carts/${cart.id}/customer`,
                {},
                storeHeadersWithCustomer
              )
            ).data.cart

            expect(transferredCart).toEqual(
              expect.objectContaining({
                id: cart.id,
                items: expect.arrayContaining([
                  expect.objectContaining({
                    unit_price: 200,
                    compare_at_unit_price: 1500,
                    is_tax_inclusive: true,
                    quantity: 1,
                  }),
                ]),
              })
            )

            let response = await api.post(
              `/store/carts/${cart.id}/line-items`,
              {
                variant_id: product.variants[0].id,
                quantity: 1,
              },
              storeHeadersWithCustomer
            )

            expect(response.status).toEqual(200)
            expect(response.data.cart).toEqual(
              expect.objectContaining({
                id: cart.id,
                currency_code: "usd",
                items: expect.arrayContaining([
                  expect.objectContaining({
                    unit_price: 200,
                    compare_at_unit_price: 1500,
                    is_tax_inclusive: true,
                    quantity: 2,
                  }),
                ]),
              })
            )
          })
        })

        describe("with manage_inventory true", () => {
          let inventoryItem
          beforeEach(async () => {
            await api.post(
              `/admin/products/${product.id}/variants/${product.variants[0].id}`,
              { manage_inventory: true },
              adminHeaders
            )

            inventoryItem = (
              await api.post(
                `/admin/inventory-items`,
                { sku: "bottle" },
                adminHeaders
              )
            ).data.inventory_item
          })

          describe("with allow_backorder true", () => {
            beforeEach(async () => {
              await api.post(
                `/admin/products/${product.id}/variants/${product.variants[0].id}`,
                { allow_backorder: true },
                adminHeaders
              )
            })

            it("should add item to cart even if no inventory locations", async () => {
              let response = await api.post(
                `/store/carts/${cart.id}/line-items`,
                {
                  variant_id: product.variants[0].id,
                  quantity: 1,
                },
                storeHeaders
              )

              expect(response.status).toEqual(200)
            })

            it("should add item to cart even if inventory is empty", async () => {
              await api.post(
                `/admin/inventory-items/${inventoryItem.id}/location-levels/batch`,
                { create: [{ location_id: stockLocation.id }] },
                adminHeaders
              )

              let response = await api.post(
                `/store/carts/${cart.id}/line-items`,
                {
                  variant_id: product.variants[0].id,
                  quantity: 1,
                },
                storeHeaders
              )

              expect(response.status).toEqual(200)
            })
          })
        })
      })

      describe("POST /store/carts/:id/line-items/:id", () => {
        let item, customerGroup

        beforeEach(async () => {
          cart = (
            await api.post(
              `/store/carts`,
              {
                currency_code: "usd",
                sales_channel_id: salesChannel.id,
                region_id: region.id,
                shipping_address: shippingAddressData,
                items: [{ variant_id: product.variants[0].id, quantity: 1 }],
              },
              storeHeadersWithCustomer
            )
          ).data.cart

          item = cart.items[0]

          customerGroup = (
            await api.post(
              "/admin/customer-groups",
              { name: "VIP" },
              adminHeaders
            )
          ).data.customer_group

          await api.post(
            `/admin/customer-groups/${customerGroup.id}/customers`,
            {
              add: [customer.id],
            },
            adminHeaders
          )
        })

        it("should update cart's line item", async () => {
          let response = await api.post(
            `/store/carts/${cart.id}/line-items/${item.id}`,
            {
              quantity: 2,
            },
            storeHeaders
          )

          expect(response.status).toEqual(200)
          expect(response.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              currency_code: "usd",
              items: expect.arrayContaining([
                expect.objectContaining({
                  unit_price: 1500,
                  quantity: 2,
                }),
              ]),
            })
          )

          await api.post(
            `/admin/price-lists`,
            {
              title: "test price list",
              description: "test",
              status: PriceListStatus.ACTIVE,
              type: PriceListType.SALE,
              prices: [
                {
                  amount: 200,
                  currency_code: "usd",
                  variant_id: product.variants[0].id,
                },
              ],
              rules: {
                "customer.groups.id": [customerGroup.id],
              },
            },
            adminHeaders
          )

          response = await api.post(
            `/store/carts/${cart.id}/line-items/${item.id}`,
            { quantity: 3 },
            storeHeaders
          )

          expect(response.status).toEqual(200)
          expect(response.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              currency_code: "usd",
              items: expect.arrayContaining([
                expect.objectContaining({
                  unit_price: 200,
                  quantity: 3,
                }),
              ]),
            })
          )
        })
      })

      describe("POST /store/carts/:id/complete", () => {
        describe("should successfully complete cart", () => {
          beforeEach(async () => {
            const stockLocation = (
              await api.post(
                `/admin/stock-locations`,
                { name: "test location" },
                adminHeaders
              )
            ).data.stock_location

            await api.post(
              `/admin/stock-locations/${stockLocation.id}/sales-channels`,
              { add: [salesChannel.id] },
              adminHeaders
            )

            const fulfillmentSets = (
              await api.post(
                `/admin/stock-locations/${stockLocation.id}/fulfillment-sets?fields=*fulfillment_sets`,
                {
                  name: `Test-${shippingProfile.id}`,
                  type: "test-type",
                },
                adminHeaders
              )
            ).data.stock_location.fulfillment_sets

            const fulfillmentSet = (
              await api.post(
                `/admin/fulfillment-sets/${fulfillmentSets[0].id}/service-zones`,
                {
                  name: `Test-${shippingProfile.id}`,
                  geo_zones: [{ type: "country", country_code: "US" }],
                },
                adminHeaders
              )
            ).data.fulfillment_set

            await api.post(
              `/admin/stock-locations/${stockLocation.id}/fulfillment-providers`,
              { add: ["manual_test-provider"] },
              adminHeaders
            )

            const shippingOption = (
              await api.post(
                `/admin/shipping-options`,
                {
                  name: `Test shipping option ${fulfillmentSet.id}`,
                  service_zone_id: fulfillmentSet.service_zones[0].id,
                  shipping_profile_id: shippingProfile.id,
                  provider_id: "manual_test-provider",
                  price_type: "flat",
                  type: {
                    label: "Test type",
                    description: "Test description",
                    code: "test-code",
                  },
                  prices: [{ currency_code: "usd", amount: 1000 }],
                  rules: [],
                },
                adminHeaders
              )
            ).data.shipping_option

            cart = (
              await api.post(
                `/store/carts`,
                {
                  currency_code: "usd",
                  sales_channel_id: salesChannel.id,
                  region_id: region.id,
                  shipping_address: shippingAddressData,
                  items: [{ variant_id: product.variants[0].id, quantity: 1 }],
                  promo_codes: [promotion.code],
                },
                storeHeadersWithCustomer
              )
            ).data.cart

            await api.post(
              `/store/carts/${cart.id}/shipping-methods`,
              { option_id: shippingOption.id },
              storeHeaders
            )
          })

          it("should successfully complete cart", async () => {
            const paymentCollection = (
              await api.post(
                `/store/payment-collections`,
                { cart_id: cart.id },
                storeHeaders
              )
            ).data.payment_collection

            await api.post(
              `/store/payment-collections/${paymentCollection.id}/payment-sessions`,
              { provider_id: "pp_system_default" },
              storeHeaders
            )

            createCartCreditLinesWorkflow.run({
              input: [
                {
                  cart_id: cart.id,
                  amount: 100,
                  currency_code: "usd",
                  reference: "test",
                  reference_id: "test",
                },
              ],
              container: appContainer,
            })

            const response = await api.post(
              `/store/carts/${cart.id}/complete`,
              {},
              storeHeaders
            )

            expect(response.status).toEqual(200)
            expect(response.data.order).toEqual(
              expect.objectContaining({
                id: expect.any(String),
                currency_code: "usd",
                credit_lines: [
                  expect.objectContaining({
                    amount: 100,
                    reference: "test",
                    reference_id: "test",
                  }),
                ],
                items: expect.arrayContaining([
                  expect.objectContaining({
                    unit_price: 1500,
                    compare_at_unit_price: null,
                    quantity: 1,
                  }),
                ]),
              })
            )
          })

          it("should successfully complete cart with credit lines alone", async () => {
            const oldCart = (
              await api.get(`/store/carts/${cart.id}`, storeHeaders)
            ).data.cart

            createCartCreditLinesWorkflow.run({
              input: [
                {
                  cart_id: oldCart.id,
                  amount: oldCart.total,
                  currency_code: "usd",
                  reference: "test",
                  reference_id: "test",
                },
              ],
              container: appContainer,
            })

            const response = await api.post(
              `/store/carts/${cart.id}/complete`,
              {},
              storeHeaders
            )

            expect(response.status).toEqual(200)
            expect(response.data.order).toEqual(
              expect.objectContaining({
                id: expect.any(String),
                currency_code: "usd",
                credit_line_total: 2395,
                discount_total: 100,
                credit_lines: [
                  expect.objectContaining({
                    amount: 2395,
                  }),
                ],
                items: expect.arrayContaining([
                  expect.objectContaining({
                    unit_price: 1500,
                    compare_at_unit_price: null,
                    quantity: 1,
                  }),
                ]),
              })
            )
          })

          it("should successfully complete cart without shipping for digital products", async () => {
            /**
             * Product has a shipping profile so cart item should not require shipping
             */
            const product = (
              await api.post(
                `/admin/products`,
                {
                  title: "Product without inventory management",
                  description: "test",
                  options: [
                    {
                      title: "Size",
                      values: ["S", "M", "L", "XL"],
                    },
                  ],
                  variants: [
                    {
                      title: "S / Black",
                      sku: "special-shirt",
                      options: {
                        Size: "S",
                      },
                      manage_inventory: false,
                      prices: [
                        {
                          amount: 1500,
                          currency_code: "usd",
                        },
                      ],
                    },
                  ],
                },
                adminHeaders
              )
            ).data.product

            cart = (
              await api.post(
                `/store/carts`,
                {
                  currency_code: "usd",
                  sales_channel_id: salesChannel.id,
                  region_id: region.id,
                  shipping_address: shippingAddressData,
                },
                storeHeadersWithCustomer
              )
            ).data.cart

            cart = (
              await api.post(
                `/store/carts/${cart.id}/line-items`,
                {
                  variant_id: product.variants[0].id,
                  quantity: 1,
                },
                storeHeaders
              )
            ).data.cart

            const paymentCollection = (
              await api.post(
                `/store/payment-collections`,
                { cart_id: cart.id },
                storeHeaders
              )
            ).data.payment_collection

            await api.post(
              `/store/payment-collections/${paymentCollection.id}/payment-sessions`,
              { provider_id: "pp_system_default" },
              storeHeaders
            )

            expect(cart.items[0].requires_shipping).toEqual(false)

            const response = await api.post(
              `/store/carts/${cart.id}/complete`,
              {},
              storeHeaders
            )

            expect(response.status).toEqual(200)
            expect(response.data.order).toEqual(
              expect.objectContaining({
                shipping_methods: [],
                items: expect.arrayContaining([
                  expect.objectContaining({
                    requires_shipping: false,
                  }),
                ]),
              })
            )
          })

          describe("with sale price lists", () => {
            let priceList

            beforeEach(async () => {
              priceList = (
                await api.post(
                  `/admin/price-lists`,
                  {
                    title: "test price list",
                    description: "test",
                    status: PriceListStatus.ACTIVE,
                    type: PriceListType.SALE,
                    prices: [
                      {
                        amount: 350,
                        currency_code: "usd",
                        variant_id: product.variants[0].id,
                      },
                    ],
                  },
                  adminHeaders
                )
              ).data.price_list

              await api.post(
                `/store/carts/${cart.id}/line-items`,
                { variant_id: product.variants[0].id, quantity: 1 },
                storeHeaders
              )

              const paymentCollection = (
                await api.post(
                  `/store/payment-collections`,
                  { cart_id: cart.id },
                  storeHeaders
                )
              ).data.payment_collection

              await api.post(
                `/store/payment-collections/${paymentCollection.id}/payment-sessions`,
                { provider_id: "pp_system_default" },
                storeHeaders
              )
            })

            it("should add price from price list and set compare_at_unit_price for order item", async () => {
              const response = await api.post(
                `/store/carts/${cart.id}/complete`,
                {},
                storeHeaders
              )

              expect(response.status).toEqual(200)
              expect(response.data.order).toEqual(
                expect.objectContaining({
                  items: expect.arrayContaining([
                    expect.objectContaining({
                      unit_price: 350,
                      compare_at_unit_price: 1500,
                      is_tax_inclusive: true,
                      quantity: 2,
                    }),
                  ]),
                })
              )
            })
          })

          describe("with inventory kit", () => {
            let stockLocation, inventoryItem, product, cart
            beforeEach(async () => {
              stockLocation = (
                await api.post(
                  `/admin/stock-locations`,
                  { name: "test location" },
                  adminHeaders
                )
              ).data.stock_location

              inventoryItem = (
                await api.post(
                  `/admin/inventory-items`,
                  { sku: "bottle" },
                  adminHeaders
                )
              ).data.inventory_item

              await api.post(
                `/admin/inventory-items/${inventoryItem.id}/location-levels`,
                {
                  location_id: stockLocation.id,
                  stocked_quantity: 10,
                },
                adminHeaders
              )

              await api.post(
                `/admin/stock-locations/${stockLocation.id}/sales-channels`,
                { add: [salesChannel.id] },
                adminHeaders
              )

              product = (
                await api.post(
                  "/admin/products",
                  {
                    title: `Test fixture ${shippingProfile.id}`,
                    shipping_profile_id: shippingProfile.id,
                    options: [
                      { title: "pack", values: ["1-pack", "2-pack", "3-pack"] },
                    ],
                    variants: [
                      {
                        title: "2-pack",
                        sku: "2-pack",
                        inventory_items: [
                          {
                            inventory_item_id: inventoryItem.id,
                            required_quantity: 2,
                          },
                        ],
                        prices: [
                          {
                            currency_code: "usd",
                            amount: 100,
                          },
                        ],
                        options: {
                          pack: "2-pack",
                        },
                      },
                      {
                        title: "3-pack",
                        sku: "3-pack",
                        inventory_items: [
                          {
                            inventory_item_id: inventoryItem.id,
                            required_quantity: 3,
                          },
                        ],
                        prices: [
                          {
                            currency_code: "usd",
                            amount: 140,
                          },
                        ],
                        options: {
                          pack: "3-pack",
                        },
                      },
                    ],
                  },
                  adminHeaders
                )
              ).data.product

              cart = (
                await api.post(
                  `/store/carts`,
                  {
                    currency_code: "usd",
                    sales_channel_id: salesChannel.id,
                    region_id: region.id,
                    shipping_address: shippingAddressData,
                    items: [
                      { variant_id: product.variants[0].id, quantity: 1 },
                      { variant_id: product.variants[1].id, quantity: 1 },
                    ],
                  },
                  storeHeadersWithCustomer
                )
              ).data.cart

              const fulfillmentSets = (
                await api.post(
                  `/admin/stock-locations/${stockLocation.id}/fulfillment-sets?fields=*fulfillment_sets`,
                  {
                    name: `Test-inventory`,
                    type: "test-type",
                  },
                  adminHeaders
                )
              ).data.stock_location.fulfillment_sets

              const fulfillmentSet = (
                await api.post(
                  `/admin/fulfillment-sets/${fulfillmentSets[0].id}/service-zones`,
                  {
                    name: `Test-inventory`,
                    geo_zones: [{ type: "country", country_code: "US" }],
                  },
                  adminHeaders
                )
              ).data.fulfillment_set

              await api.post(
                `/admin/stock-locations/${stockLocation.id}/fulfillment-providers`,
                { add: ["manual_test-provider"] },
                adminHeaders
              )

              const shippingOption = (
                await api.post(
                  `/admin/shipping-options`,
                  {
                    name: `Test shipping option ${fulfillmentSet.id}`,
                    service_zone_id: fulfillmentSet.service_zones[0].id,
                    shipping_profile_id: shippingProfile.id,
                    provider_id: "manual_test-provider",
                    price_type: "flat",
                    type: {
                      label: "Test type",
                      description: "Test description",
                      code: "test-code",
                    },
                    prices: [{ currency_code: "usd", amount: 1000 }],
                    rules: [],
                  },
                  adminHeaders
                )
              ).data.shipping_option

              await api.post(
                `/store/carts/${cart.id}/shipping-methods`,
                { option_id: shippingOption.id },
                storeHeaders
              )

              const paymentCollection = (
                await api.post(
                  `/store/payment-collections`,
                  { cart_id: cart.id },
                  storeHeaders
                )
              ).data.payment_collection

              await api.post(
                `/store/payment-collections/${paymentCollection.id}/payment-sessions`,
                { provider_id: "pp_system_default" },
                storeHeaders
              )
            })

            it("should complete a cart with inventory item shared between variants", async () => {
              const response = await api.post(
                `/store/carts/${cart.id}/complete`,
                {},
                storeHeaders
              )

              expect(response.status).toEqual(200)
              expect(response.data.order).toEqual(
                expect.objectContaining({
                  items: expect.arrayContaining([
                    expect.objectContaining({
                      subtitle: "2-pack",
                      quantity: 1,
                    }),
                    expect.objectContaining({
                      subtitle: "3-pack",
                      quantity: 1,
                    }),
                  ]),
                })
              )

              const reservations = (
                await api.get(`/admin/reservations`, adminHeaders)
              ).data.reservations

              expect(reservations).toEqual(
                expect.arrayContaining([
                  expect.objectContaining({
                    location_id: stockLocation.id,
                    inventory_item_id: inventoryItem.id,
                    quantity: 2, // 2-pack
                    inventory_item: expect.objectContaining({
                      id: inventoryItem.id,
                      sku: "bottle",
                      reserved_quantity: 5,
                      stocked_quantity: 10,
                    }),
                  }),
                  expect.objectContaining({
                    location_id: stockLocation.id,
                    inventory_item_id: inventoryItem.id,
                    quantity: 3, // 3-pack
                    inventory_item: expect.objectContaining({
                      id: inventoryItem.id,
                      sku: "bottle",
                      reserved_quantity: 5,
                      stocked_quantity: 10,
                    }),
                  }),
                ])
              )
            })
          })
        })

        describe("shipping validation", () => {
          it("should fail to complete the cart if no shipping method is selected and items require shipping", async () => {
            const cart = (
              await api.post(
                `/store/carts`,
                {
                  currency_code: "usd",
                  sales_channel_id: salesChannel.id,
                  region_id: region.id,
                  shipping_address: shippingAddressData,
                  items: [{ variant_id: product.variants[0].id, quantity: 1 }],
                  promo_codes: [promotion.code],
                },
                storeHeadersWithCustomer
              )
            ).data.cart

            const paymentCollection = (
              await api.post(
                `/store/payment-collections`,
                { cart_id: cart.id },
                storeHeaders
              )
            ).data.payment_collection

            await api.post(
              `/store/payment-collections/${paymentCollection.id}/payment-sessions`,
              { provider_id: "pp_system_default" },
              storeHeaders
            )

            const response = await api
              .post(`/store/carts/${cart.id}/complete`, {}, storeHeaders)
              .catch((e) => e)

            expect(response.response.status).toEqual(400)
            expect(response.response.data.message).toEqual(
              "No shipping method selected but the cart contains items that require shipping."
            )
          })

          it("should fail to complete the cart if the shipping profile of a product is not supported by the shipping method", async () => {
            const stockLocation = (
              await api.post(
                `/admin/stock-locations`,
                { name: "test location" },
                adminHeaders
              )
            ).data.stock_location

            await api.post(
              `/admin/stock-locations/${stockLocation.id}/sales-channels`,
              { add: [salesChannel.id] },
              adminHeaders
            )

            const shippingProfile = (
              await api.post(
                `/admin/shipping-profiles`,
                { name: `test-${stockLocation.id}`, type: "default" },
                adminHeaders
              )
            ).data.shipping_profile

            const fulfillmentSets = (
              await api.post(
                `/admin/stock-locations/${stockLocation.id}/fulfillment-sets?fields=*fulfillment_sets`,
                {
                  name: `Test-${shippingProfile.id}`,
                  type: "test-type",
                },
                adminHeaders
              )
            ).data.stock_location.fulfillment_sets

            const fulfillmentSet = (
              await api.post(
                `/admin/fulfillment-sets/${fulfillmentSets[0].id}/service-zones`,
                {
                  name: `Test-${shippingProfile.id}`,
                  geo_zones: [{ type: "country", country_code: "US" }],
                },
                adminHeaders
              )
            ).data.fulfillment_set

            await api.post(
              `/admin/stock-locations/${stockLocation.id}/fulfillment-providers`,
              { add: ["manual_test-provider"] },
              adminHeaders
            )

            const shippingOption = (
              await api.post(
                `/admin/shipping-options`,
                {
                  name: `Test shipping option ${fulfillmentSet.id}`,
                  service_zone_id: fulfillmentSet.service_zones[0].id,
                  shipping_profile_id: shippingProfile.id,
                  provider_id: "manual_test-provider",
                  price_type: "flat",
                  type: {
                    label: "Test type",
                    description: "Test description",
                    code: "test-code",
                  },
                  prices: [{ currency_code: "usd", amount: 1000 }],
                  rules: [],
                },
                adminHeaders
              )
            ).data.shipping_option

            const specialShippingProfile = (
              await api.post(
                `/admin/shipping-profiles`,
                { name: "special-shipping-profile", type: "special" },
                adminHeaders
              )
            ).data.shipping_profile

            const product = (
              await api.post(
                `/admin/products`,
                {
                  title: "test product",
                  description: "test",
                  options: [
                    {
                      title: "Size",
                      values: ["S", "M", "L", "XL"],
                    },
                  ],
                  variants: [
                    {
                      title: "S / Black",
                      sku: "special-shirt",
                      options: {
                        Size: "S",
                      },
                      manage_inventory: false,
                      prices: [
                        {
                          amount: 1500,
                          currency_code: "usd",
                        },
                      ],
                    },
                  ],
                  shipping_profile_id: specialShippingProfile.id, // --> product has a different shipping profile than
                },
                adminHeaders
              )
            ).data.product

            const cart = (
              await api.post(
                `/store/carts`,
                {
                  currency_code: "usd",
                  sales_channel_id: salesChannel.id,
                  region_id: region.id,
                  shipping_address: shippingAddressData,
                  items: [{ variant_id: product.variants[0].id, quantity: 1 }],
                  promo_codes: [promotion.code],
                },
                storeHeadersWithCustomer
              )
            ).data.cart

            await api.post(
              `/store/carts/${cart.id}/shipping-methods`,
              { option_id: shippingOption.id },
              storeHeaders
            )

            const paymentCollection = (
              await api.post(
                `/store/payment-collections`,
                { cart_id: cart.id },
                storeHeaders
              )
            ).data.payment_collection

            await api.post(
              `/store/payment-collections/${paymentCollection.id}/payment-sessions`,
              { provider_id: "pp_system_default" },
              storeHeaders
            )

            const response = await api
              .post(`/store/carts/${cart.id}/complete`, {}, storeHeaders)
              .catch((e) => e)

            expect(response.response.status).toEqual(400)
            expect(response.response.data.message).toEqual(
              "The cart items require shipping profiles that are not satisfied by the current shipping methods"
            )
          })
        })
      })

      describe("POST /store/carts/:id", () => {
        let otherRegion

        beforeEach(async () => {
          const cartData = {
            currency_code: "usd",
            sales_channel_id: salesChannel.id,
            region_id: region.id,
            shipping_address: shippingAddressData,
            items: [{ variant_id: product.variants[0].id, quantity: 1 }],
            promo_codes: [promotion.code],
          }

          cart = (await api.post(`/store/carts`, cartData, storeHeaders)).data
            .cart

          otherRegion = (
            await api.post(
              "/admin/regions",
              { name: "dk", currency_code: "dkk", countries: ["dk"] },
              adminHeaders
            )
          ).data.region
        })

        it("should update prices when region is changed", async () => {
          let updated = await api.post(
            `/store/carts/${cart.id}/line-items`,
            { variant_id: product.variants[0].id, quantity: 1 },
            storeHeaders
          )

          expect(updated.status).toEqual(200)
          expect(updated.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              currency_code: "usd",
              items: [
                expect.objectContaining({
                  unit_price: 1500,
                  quantity: 2,
                }),
              ],
            })
          )

          updated = await api.post(
            `/store/carts/${cart.id}`,
            { region_id: otherRegion.id },
            storeHeaders
          )

          expect(updated.status).toEqual(200)
          expect(updated.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              currency_code: "dkk",
              items: [
                expect.objectContaining({
                  unit_price: 1300,
                  quantity: 2,
                }),
              ],
            })
          )

          updated = await api.post(
            `/store/carts/${cart.id}/line-items`,
            { variant_id: product.variants[0].id, quantity: 1 },
            storeHeaders
          )

          expect(updated.status).toEqual(200)
          expect(updated.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              currency_code: "dkk",
              items: [
                expect.objectContaining({
                  unit_price: 1300,
                  quantity: 3,
                }),
              ],
            })
          )
        })

        it("should update a cart with promo codes with a replace action", async () => {
          const newPromotion = (
            await api.post(
              `/admin/promotions`,
              {
                code: "PROMOTION_TEST",
                type: PromotionType.STANDARD,
                status: PromotionStatus.ACTIVE,
                application_method: {
                  type: "fixed",
                  target_type: "items",
                  allocation: "across",
                  currency_code: "usd",
                  value: 1000,
                  apply_to_quantity: 1,
                  target_rules: [
                    {
                      attribute: "product_id",
                      operator: PromotionRuleOperator.IN,
                      values: [product.id],
                    },
                  ],
                },
              },
              adminHeaders
            )
          ).data.promotion

          await api.post(
            `/store/carts/${cart.id}/line-items`,
            {
              variant_id: product.variants[0].id,
              quantity: 1,
            },
            storeHeaders
          )

          // Should remove earlier adjustments from other promocodes
          let updated = await api.post(
            `/store/carts/${cart.id}`,
            { promo_codes: [newPromotion.code] },
            storeHeaders
          )

          expect(updated.status).toEqual(200)
          expect(updated.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              items: [
                expect.objectContaining({
                  adjustments: [
                    expect.objectContaining({
                      code: newPromotion.code,
                    }),
                  ],
                }),
              ],
            })
          )

          // Should remove all adjustments from other promo codes
          updated = await api.post(
            `/store/carts/${cart.id}`,
            { promo_codes: [] },
            storeHeaders
          )

          expect(updated.status).toEqual(200)
          expect(updated.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              items: [
                expect.objectContaining({
                  adjustments: [],
                }),
              ],
            })
          )
        })

        it("should not generate tax lines if automatic taxes is false", async () => {
          let updated = await api.post(
            `/store/carts/${cart.id}`,
            {},
            storeHeaders
          )

          expect(updated.status).toEqual(200)
          expect(updated.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              items: [
                expect.objectContaining({
                  tax_lines: [
                    expect.objectContaining({
                      description: "CA Default Rate",
                      code: "CADEFAULT",
                      rate: 5,
                      provider_id: "system",
                    }),
                  ],
                }),
              ],
            })
          )

          updated = await api.post(
            `/store/carts/${cart.id}`,
            { region_id: noAutomaticRegion.id },
            storeHeaders
          )

          expect(updated.status).toEqual(200)
          expect(updated.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              items: [
                expect.objectContaining({
                  tax_lines: [],
                }),
              ],
            })
          )
        })

        it("should not generate tax lines for gift card products", async () => {
          const giftCardProduct = (
            await api.post(
              `/admin/products`,
              {
                title: "Gift Card",
                description: "test",
                is_giftcard: true,
                options: [
                  {
                    title: "Denomination",
                    values: ["10", "20", "50", "100"],
                  },
                ],
                variants: [
                  {
                    title: "10",
                    sku: "special-shirt",
                    options: {
                      Denomination: "10",
                    },
                    manage_inventory: false,
                    prices: [
                      {
                        amount: 1000,
                        currency_code: "usd",
                      },
                    ],
                  },
                ],
              },
              adminHeaders
            )
          ).data.product

          let updated = await api.post(
            `/store/carts/${cart.id}/line-items?fields=+items.is_giftcard`,
            { variant_id: giftCardProduct.variants[0].id, quantity: 1 },
            storeHeaders
          )

          expect(updated.status).toEqual(200)
          expect(updated.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              items: expect.arrayContaining([
                expect.objectContaining({
                  is_giftcard: false,
                  tax_lines: [
                    expect.objectContaining({
                      description: "CA Default Rate",
                      code: "CADEFAULT",
                      rate: 5,
                      provider_id: "system",
                    }),
                  ],
                }),
                expect.objectContaining({
                  is_giftcard: true,
                  tax_lines: [],
                }),
              ]),
            })
          )
        })

        it("should update a cart's region, sales channel, customer data and tax lines", async () => {
          const newSalesChannel = (
            await api.post(
              "/admin/sales-channels",
              { name: "Webshop", description: "channel" },
              adminHeaders
            )
          ).data.sales_channel

          let updated = await api.post(
            `/store/carts/${cart.id}`,
            {
              region_id: noAutomaticRegion.id,
              email: "tony@stark.com",
              sales_channel_id: newSalesChannel.id,
            },
            storeHeaders
          )

          expect(updated.status).toEqual(200)
          expect(updated.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              region: expect.objectContaining({
                id: noAutomaticRegion.id,
                currency_code: "eur",
              }),
              email: "tony@stark.com",
              customer: expect.objectContaining({
                email: "tony@stark.com",
              }),
              sales_channel_id: newSalesChannel.id,
            })
          )
        })

        it("should update tax lines on cart items when region changes", async () => {
          let response = await api.post(
            `/store/carts/${cart.id}`,
            {
              region_id: otherRegion.id,
              shipping_address: {
                country_code: "dk",
              },
            },
            storeHeaders
          )

          expect(response.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              currency_code: "dkk",
              region_id: otherRegion.id,
              items: expect.arrayContaining([
                expect.objectContaining({
                  unit_price: 1300,
                  quantity: 1,
                  tax_lines: [
                    // Uses the danish default rate
                    expect.objectContaining({
                      description: "Denmark Default Rate",
                      code: "DK_DEF",
                      rate: 25,
                      provider_id: "system",
                    }),
                  ],
                }),
              ]),
            })
          )
        })

        it("should update region + set shipping address country code to dk when region has only one country", async () => {
          const updated = await api.post(
            `/store/carts/${cart.id}`,
            {
              region_id: otherRegion.id,
            },
            storeHeaders
          )

          expect(updated.status).toEqual(200)
          expect(updated.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              currency_code: "dkk",
              region: expect.objectContaining({
                id: otherRegion.id,
                currency_code: "dkk",
                countries: [expect.objectContaining({ iso_2: "dk" })],
              }),
              shipping_address: expect.objectContaining({
                country_code: "dk",
              }),
            })
          )
        })

        it("should update region + set shipping address to null when region has more than one country", async () => {
          const regionWithMultipleCountries = (
            await api.post(
              "/admin/regions",
              { name: "dks", currency_code: "dkk", countries: ["ae", "no"] },
              adminHeaders
            )
          ).data.region

          const updated = await api.post(
            `/store/carts/${cart.id}`,
            { region_id: regionWithMultipleCountries.id },
            storeHeaders
          )

          expect(updated.status).toEqual(200)
          expect(updated.data.cart).toEqual(
            expect.objectContaining({
              currency_code: "dkk",
              region: expect.objectContaining({
                currency_code: "dkk",
                countries: expect.arrayContaining([
                  expect.objectContaining({ iso_2: "ae" }),
                  expect.objectContaining({ iso_2: "no" }),
                ]),
              }),
              shipping_address: null,
            })
          )
        })

        it("should update region and shipping address when country code is within region", async () => {
          const updated = await api.post(
            `/store/carts/${cart.id}`,
            {
              region_id: region.id,
              shipping_address: {
                country_code: "us",
              },
            },
            storeHeaders
          )

          expect(updated.status).toEqual(200)
          expect(updated.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              region: expect.objectContaining({
                id: region.id,
                countries: [expect.objectContaining({ iso_2: "us" })],
              }),
              shipping_address: expect.objectContaining({
                country_code: "us",
              }),
            })
          )
        })

        it("should throw when updating shipping address country code when country is not within region", async () => {
          let errResponse = await api
            .post(
              `/store/carts/${cart.id}`,
              {
                shipping_address: {
                  country_code: "dk",
                },
              },
              storeHeaders
            )
            .catch((e) => e)

          expect(errResponse.response.status).toEqual(400)
          expect(errResponse.response.data.message).toEqual(
            `Country with code dk is not within region ${region.name}`
          )
        })

        it("should throw when updating region and shipping address, but shipping address country code is not within region", async () => {
          let errResponse = await api
            .post(
              `/store/carts/${cart.id}`,
              {
                region_id: region.id,
                shipping_address: {
                  country_code: "dk",
                },
              },
              storeHeaders
            )
            .catch((e) => e)

          expect(errResponse.response.status).toEqual(400)
          expect(errResponse.response.data.message).toEqual(
            `Country with code dk is not within region ${region.name}`
          )
        })

        it("should remove tax lines on cart items and shipping methods when country changes and there is no tax region for that country", async () => {
          const stockLocation = (
            await api.post(
              `/admin/stock-locations`,
              { name: "test location" },
              adminHeaders
            )
          ).data.stock_location

          await api.post(
            `/admin/stock-locations/${stockLocation.id}/sales-channels`,
            { add: [salesChannel.id] },
            adminHeaders
          )

          const shippingProfile = (
            await api.post(
              `/admin/shipping-profiles`,
              { name: `test-${stockLocation.id}`, type: "default" },
              adminHeaders
            )
          ).data.shipping_profile

          const fulfillmentSets = (
            await api.post(
              `/admin/stock-locations/${stockLocation.id}/fulfillment-sets?fields=*fulfillment_sets`,
              {
                name: `Test-${shippingProfile.id}`,
                type: "test-type",
              },
              adminHeaders
            )
          ).data.stock_location.fulfillment_sets

          const fulfillmentSet = (
            await api.post(
              `/admin/fulfillment-sets/${fulfillmentSets[0].id}/service-zones`,
              {
                name: `Test-${shippingProfile.id}`,
                geo_zones: [
                  { type: "country", country_code: "it" },
                  { type: "country", country_code: "us" },
                ],
              },
              adminHeaders
            )
          ).data.fulfillment_set

          await api.post(
            `/admin/stock-locations/${stockLocation.id}/fulfillment-providers`,
            { add: ["manual_test-provider"] },
            adminHeaders
          )

          const shippingOption = (
            await api.post(
              `/admin/shipping-options`,
              {
                name: `Test shipping option ${fulfillmentSet.id}`,
                service_zone_id: fulfillmentSet.service_zones[0].id,
                shipping_profile_id: shippingProfile.id,
                provider_id: "manual_test-provider",
                price_type: "flat",
                type: {
                  label: "Test type",
                  description: "Test description",
                  code: "test-code",
                },
                prices: [
                  { currency_code: "usd", amount: 1000 },
                  { currency_code: "eur", amount: 1000 },
                  { currency_code: "dkk", amount: 1000 },
                ],
                rules: [],
              },
              adminHeaders
            )
          ).data.shipping_option

          const regionWithoutTax = (
            await api.post(
              "/admin/regions",
              { name: "Italy", currency_code: "eur", countries: ["it"] },
              adminHeaders
            )
          ).data.region

          await api.post(
            `/store/carts/${cart.id}`,
            { region_id: regionWithoutTax.id },
            storeHeaders
          )

          await api.post(
            `/store/carts/${cart.id}/shipping-methods`,
            { option_id: shippingOption.id },
            storeHeaders
          )

          const response = await api.post(
            `/store/carts/${cart.id}`,
            { region_id: regionWithoutTax.id },
            storeHeaders
          )

          expect(response.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              currency_code: "eur",
              region_id: regionWithoutTax.id,
              items: expect.arrayContaining([
                expect.objectContaining({
                  tax_lines: [
                    // Italy has no tax region, so we clear the tax lines
                  ],
                }),
              ]),
              shipping_methods: expect.arrayContaining([
                expect.objectContaining({
                  tax_lines: [
                    // Italy has no tax region, so we clear the tax lines
                  ],
                }),
              ]),
            })
          )
        })

        it("should remove invalid shipping methods", async () => {
          const stockLocation = (
            await api.post(
              `/admin/stock-locations`,
              { name: "test location" },
              adminHeaders
            )
          ).data.stock_location

          await api.post(
            `/admin/stock-locations/${stockLocation.id}/sales-channels`,
            { add: [salesChannel.id] },
            adminHeaders
          )

          const shippingProfile = (
            await api.post(
              `/admin/shipping-profiles`,
              { name: `test-${stockLocation.id}`, type: "default" },
              adminHeaders
            )
          ).data.shipping_profile

          const fulfillmentSets = (
            await api.post(
              `/admin/stock-locations/${stockLocation.id}/fulfillment-sets?fields=*fulfillment_sets`,
              {
                name: `Test-${shippingProfile.id}`,
                type: "test-type",
              },
              adminHeaders
            )
          ).data.stock_location.fulfillment_sets

          const fulfillmentSet = (
            await api.post(
              `/admin/fulfillment-sets/${fulfillmentSets[0].id}/service-zones`,
              {
                name: `Test-${shippingProfile.id}`,
                geo_zones: [{ type: "country", country_code: "it" }],
              },
              adminHeaders
            )
          ).data.fulfillment_set

          await api.post(
            `/admin/stock-locations/${stockLocation.id}/fulfillment-providers`,
            { add: ["manual_test-provider"] },
            adminHeaders
          )

          const shippingOption = (
            await api.post(
              `/admin/shipping-options`,
              {
                name: `Test shipping option ${fulfillmentSet.id}`,
                service_zone_id: fulfillmentSet.service_zones[0].id,
                shipping_profile_id: shippingProfile.id,
                provider_id: "manual_test-provider",
                price_type: "flat",
                type: {
                  label: "Test type",
                  description: "Test description",
                  code: "test-code",
                },
                prices: [
                  { currency_code: "usd", amount: 1000 },
                  { currency_code: "eur", amount: 1000 },
                ],
                rules: [
                  {
                    attribute: "enabled_in_store",
                    value: "true",
                    operator: "eq",
                  },
                  {
                    attribute: "is_return",
                    value: "false",
                    operator: "eq",
                  },
                ],
              },
              adminHeaders
            )
          ).data.shipping_option

          const regionWithoutTax = (
            await api.post(
              "/admin/regions",
              { name: "Italy", currency_code: "eur", countries: ["it"] },
              adminHeaders
            )
          ).data.region

          await api.post(
            `/store/carts/${cart.id}`,
            { region_id: regionWithoutTax.id },
            storeHeaders
          )

          await api.post(
            `/store/carts/${cart.id}/shipping-methods`,
            { option_id: shippingOption.id },
            storeHeaders
          )

          let updated = await api.post(
            `/store/carts/${cart.id}`,
            { region_id: region.id },
            storeHeaders
          )

          expect(updated.status).toEqual(200)
          expect(updated.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              shipping_methods: [],
            })
          )
        })

        it("should update email irregardless of registered customer", async () => {
          const updateEmailWithoutCustomer = await api.post(
            `/store/carts/${cart.id}`,
            { email: "tony@stark.com" },
            storeHeaders
          )

          expect(updateEmailWithoutCustomer.data.cart).toEqual(
            expect.objectContaining({
              email: "tony@stark.com",
              customer: expect.objectContaining({
                email: "tony@stark.com",
              }),
            })
          )

          const updateCartCustomer = await api.post(
            `/store/carts/${cart.id}/customer`,
            {},
            storeHeadersWithCustomer
          )

          expect(updateCartCustomer.data.cart).toEqual(
            expect.objectContaining({
              email: "tony@stark-industries.com",
              customer: expect.objectContaining({
                id: customer.id,
                email: "tony@stark-industries.com",
              }),
            })
          )

          const updateEmailWithCustomer = await api.post(
            `/store/carts/${cart.id}`,
            { email: "new@stark.com" },
            storeHeaders
          )

          expect(updateEmailWithCustomer.data.cart).toEqual(
            expect.objectContaining({
              email: "new@stark.com",
              customer: expect.objectContaining({
                id: customer.id,
                email: "tony@stark-industries.com",
              }),
            })
          )
        })

        it("should only apply promotion on discountable items", async () => {
          const notDiscountableProduct = (
            await api.post(
              "/admin/products",
              {
                title: "Medusa T-Shirt not discountable",
                handle: "t-shirt-not-discountable",
                discountable: false,
                options: [
                  {
                    title: "Size",
                    values: ["S"],
                  },
                ],
                variants: [
                  {
                    title: "S",
                    sku: "s-shirt",
                    options: {
                      Size: "S",
                    },
                    manage_inventory: false,
                    prices: [
                      {
                        amount: 1000,
                        currency_code: "usd",
                      },
                    ],
                  },
                ],

                shipping_profile_id: shippingProfile.id,
              },
              adminHeaders
            )
          ).data.product

          const cartData = {
            currency_code: "usd",
            sales_channel_id: salesChannel.id,
            region_id: region.id,
            shipping_address: shippingAddressData,
            items: [
              { variant_id: product.variants[0].id, quantity: 1 },
              {
                variant_id: notDiscountableProduct.variants[0].id,
                quantity: 1,
              },
            ],
            promo_codes: [promotion.code],
          }

          const cart = (
            await api.post(
              `/store/carts?fields=+items.is_discountable,+items.total,+items.discount_total`,
              cartData,
              storeHeaders
            )
          ).data.cart

          expect(cart).toEqual(
            expect.objectContaining({
              discount_subtotal: 100,
              items: expect.arrayContaining([
                expect.objectContaining({
                  variant_id: product.variants[0].id,
                  is_discountable: true,
                  unit_price: 1500,
                  total: 1395,
                  discount_total: 100,
                  adjustments: [
                    expect.objectContaining({
                      promotion_id: promotion.id,
                      amount: 100,
                    }),
                  ],
                }),
                expect.objectContaining({
                  variant_id: notDiscountableProduct.variants[0].id,
                  is_discountable: false,
                  total: 1000,
                  unit_price: 1000,
                  discount_total: 0,
                  adjustments: [],
                }),
              ]),
            })
          )
        })

        it("should remove promotion adjustments when promotion is deleted", async () => {
          let cartBeforeRemovingPromotion = (
            await api.get(`/store/carts/${cart.id}`, storeHeaders)
          ).data.cart

          expect(cartBeforeRemovingPromotion).toEqual(
            expect.objectContaining({
              id: cart.id,
              items: expect.arrayContaining([
                expect.objectContaining({
                  adjustments: [
                    {
                      id: expect.any(String),
                      code: "PROMOTION_APPLIED",
                      promotion_id: promotion.id,
                      amount: 100,
                    },
                  ],
                }),
              ]),
            })
          )

          await api.delete(`/admin/promotions/${promotion.id}`, adminHeaders)

          let response = await api.post(
            `/store/carts/${cart.id}`,
            {
              email: "test@test.com",
            },
            storeHeaders
          )

          expect(response.status).toEqual(200)
          expect(response.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              items: expect.arrayContaining([
                expect.objectContaining({
                  adjustments: [],
                }),
              ]),
            })
          )
        })
      })

      describe("POST /store/carts/:id/customer", () => {
        beforeEach(async () => {
          cart = (
            await api.post(
              `/store/carts`,
              {
                currency_code: "usd",
                sales_channel_id: salesChannel.id,
                region_id: region.id,
                items: [{ variant_id: product.variants[0].id, quantity: 1 }],
              },
              storeHeaders
            )
          ).data.cart
        })

        it("should throw 401 when user is not logged in as a customer", async () => {
          const { response } = await api
            .post(`/store/carts/${cart.id}/customer`, {}, storeHeaders)
            .catch((e) => e)

          expect(response.status).toEqual(401)
        })

        it("should throw error when cart does not exist", async () => {
          const { response } = await api
            .post(
              `/store/carts/does-not-exist/customer`,
              {},
              storeHeadersWithCustomer
            )
            .catch((e) => e)

          expect(response.status).toEqual(404)
          expect(response.data.message).toEqual(
            "Cart id not found: does-not-exist"
          )
        })

        it("should successfully update cart customer when cart is without customer", async () => {
          const updated = await api.post(
            `/store/carts/${cart.id}/customer`,
            {},
            storeHeadersWithCustomer
          )

          expect(updated.status).toEqual(200)
          expect(updated.data.cart).toEqual(
            expect.objectContaining({
              email: customer.email,
              customer: expect.objectContaining({
                id: customer.id,
                email: customer.email,
              }),
            })
          )
        })

        it("should successfully update cart customer when cart has a guest customer", async () => {
          const guestEmail = "tony@guest.com"
          const updatedCart = await api.post(
            `/store/carts/${cart.id}`,
            { email: guestEmail },
            storeHeadersWithCustomer
          )

          expect(updatedCart.status).toEqual(200)
          expect(updatedCart.data.cart).toEqual(
            expect.objectContaining({
              email: guestEmail,
              customer: expect.objectContaining({
                email: guestEmail,
              }),
            })
          )

          const updated = await api.post(
            `/store/carts/${cart.id}/customer`,
            {},
            storeHeadersWithCustomer
          )

          expect(updated.status).toEqual(200)
          expect(updated.data.cart).toEqual(
            expect.objectContaining({
              email: customer.email,
              customer: expect.objectContaining({
                id: customer.id,
                email: customer.email,
              }),
            })
          )
        })

        it("should successfully update cart customer when customer already owns the cart", async () => {
          const guestEmail = "tony@guest.com"

          await api.post(
            `/store/carts/${cart.id}/customer`,
            {},
            storeHeadersWithCustomer
          )

          const updatedCart = await api.post(
            `/store/carts/${cart.id}`,
            { email: guestEmail },
            storeHeadersWithCustomer
          )

          expect(updatedCart.status).toEqual(200)
          expect(updatedCart.data.cart).toEqual(
            expect.objectContaining({
              email: guestEmail,
              customer: expect.objectContaining({
                email: customer.email,
              }),
            })
          )

          const updated = await api.post(
            `/store/carts/${cart.id}/customer`,
            {},
            storeHeadersWithCustomer
          )

          expect(updated.status).toEqual(200)
          expect(updated.data.cart).toEqual(
            expect.objectContaining({
              email: guestEmail,
              customer: expect.objectContaining({
                id: customer.id,
                email: customer.email,
              }),
            })
          )
        })
      })

      describe("POST /store/carts/:id/shipping-methods", () => {
        let shippingOption

        beforeEach(async () => {
          const stockLocation = (
            await api.post(
              `/admin/stock-locations`,
              { name: "test location" },
              adminHeaders
            )
          ).data.stock_location

          await api.post(
            `/admin/stock-locations/${stockLocation.id}/sales-channels`,
            { add: [salesChannel.id] },
            adminHeaders
          )

          const shippingProfile = (
            await api.post(
              `/admin/shipping-profiles`,
              { name: `test-${stockLocation.id}`, type: "default" },
              adminHeaders
            )
          ).data.shipping_profile

          const fulfillmentSets = (
            await api.post(
              `/admin/stock-locations/${stockLocation.id}/fulfillment-sets?fields=*fulfillment_sets`,
              {
                name: `Test-${shippingProfile.id}`,
                type: "test-type",
              },
              adminHeaders
            )
          ).data.stock_location.fulfillment_sets

          const fulfillmentSet = (
            await api.post(
              `/admin/fulfillment-sets/${fulfillmentSets[0].id}/service-zones`,
              {
                name: `Test-${shippingProfile.id}`,
                geo_zones: [
                  { type: "country", country_code: "it" },
                  { type: "country", country_code: "us" },
                ],
              },
              adminHeaders
            )
          ).data.fulfillment_set

          await api.post(
            `/admin/stock-locations/${stockLocation.id}/fulfillment-providers`,
            { add: ["manual_test-provider"] },
            adminHeaders
          )

          shippingOption = (
            await api.post(
              `/admin/shipping-options`,
              {
                name: `Test shipping option ${fulfillmentSet.id}`,
                service_zone_id: fulfillmentSet.service_zones[0].id,
                shipping_profile_id: shippingProfile.id,
                provider_id: "manual_test-provider",
                price_type: "flat",
                type: {
                  label: "Test type",
                  description: "Test description",
                  code: "test-code",
                },
                prices: [
                  { currency_code: "usd", amount: 1000 },
                  {
                    currency_code: "usd",
                    amount: 500,
                    rules: [
                      {
                        attribute: "item_total",
                        operator: "gt",
                        value: 3000,
                      },
                    ],
                  },
                ],
                rules: [
                  {
                    attribute: "enabled_in_store",
                    value: "true",
                    operator: "eq",
                  },
                  {
                    attribute: "is_return",
                    value: "false",
                    operator: "eq",
                  },
                ],
              },
              adminHeaders
            )
          ).data.shipping_option

          cart = (
            await api.post(
              `/store/carts?fields=+total`,
              {
                currency_code: "usd",
                sales_channel_id: salesChannel.id,
                region_id: region.id,
                items: [{ variant_id: product.variants[0].id, quantity: 1 }],
              },
              storeHeadersWithCustomer
            )
          ).data.cart
        })

        it("should add shipping method to cart", async () => {
          let response = await api.post(
            `/store/carts/${cart.id}/shipping-methods`,
            { option_id: shippingOption.id },
            storeHeaders
          )

          expect(response.status).toEqual(200)
          expect(response.data.cart).toEqual(
            expect.objectContaining({
              id: cart.id,
              shipping_methods: expect.arrayContaining([
                expect.objectContaining({
                  shipping_option_id: shippingOption.id,
                  amount: 1000,
                  is_tax_inclusive: true,
                }),
              ]),
            })
          )

          // Total is over the amount 3000 to enable the second pricing rule
          const cart2 = (
            await api.post(
              `/store/carts?fields=+total`,
              {
                currency_code: "usd",
                sales_channel_id: salesChannel.id,
                region_id: region.id,
                items: [{ variant_id: product.variants[0].id, quantity: 5 }],
              },
              storeHeadersWithCustomer
            )
          ).data.cart

          response = await api.post(
            `/store/carts/${cart2.id}/shipping-methods`,
            { option_id: shippingOption.id },
            storeHeaders
          )

          expect(response.data.cart).toEqual(
            expect.objectContaining({
              id: cart2.id,
              shipping_methods: expect.arrayContaining([
                expect.objectContaining({
                  shipping_option_id: shippingOption.id,
                  amount: 500,
                  is_tax_inclusive: true,
                }),
              ]),
            })
          )
        })

        it("should throw when prices are not setup for shipping option", async () => {
          cart = (
            await api.post(
              `/store/carts?fields=+total`,
              {
                currency_code: "eur",
                sales_channel_id: salesChannel.id,
                region_id: region.id,
                items: [{ variant_id: product.variants[0].id, quantity: 5 }],
              },
              storeHeadersWithCustomer
            )
          ).data.cart

          let { response } = await api
            .post(
              `/store/carts/${cart.id}/shipping-methods`,
              { option_id: shippingOption.id },
              storeHeaders
            )
            .catch((e) => e)

          expect(response.data).toEqual({
            type: "invalid_data",
            message: `Shipping options with IDs ${shippingOption.id} do not have a price`,
          })
        })

        it("should throw when shipping option id is not found", async () => {
          let { response } = await api
            .post(
              `/store/carts/${cart.id}/shipping-methods`,
              { option_id: "does-not-exist" },
              storeHeaders
            )
            .catch((e) => e)

          expect(response.status).toEqual(400)
          expect(response.data).toEqual({
            type: "invalid_data",
            message: "Shipping Options are invalid for cart.",
          })
        })
      })
    })
  },
})
