import clsx from "clsx"
import { AiAssistantChatWindow, MainNav, RootProviders } from "docs-ui"
import HomepageTopSection from "../components/Homepage/TopSection"
import Providers from "../providers"
import HomepageLinksSection from "../components/Homepage/LinksSection"
import HomepageRecipesSection from "../components/Homepage/RecipesSection"
import HomepageModulesSection from "../components/Homepage/ModulesSection"
import HomepageFooter from "../components/Homepage/Footer"
import { HomepageCloudSection } from "../components/Homepage/CloudSection"

const Homepage = () => {
  return (
    <body
      className={clsx(
        "bg-medusa-bg-subtle font-base text-medium w-full",
        "text-medusa-fg-base px-0.25 pt-0.25",
        "h-screen overflow-hidden"
      )}
    >
      <RootProviders
        layoutProviderProps={{
          disableResizeObserver: true,
        }}
      >
        <Providers
          aiAssistantProps={{
            chatType: "popover",
          }}
        >
          <div
            className={clsx(
              "rounded-t bg-medusa-bg-base",
              "shadow-elevation-card-rest dark:shadow-elevation-card-rest-dark",
              "h-full w-full",
              "overflow-y-scroll overflow-x-hidden"
            )}
            id="main"
          >
            <MainNav
              className="border-b border-medusa-border-base"
              itemsClassName={clsx(
                "!my-1 [&_li_div]:!text-medusa-fg-subtle [&_li_a]:!text-medusa-fg-subtle [&_li_span]:!text-medusa-fg-subtle",
                "hover:[&_li_div]:!text-medusa-fg-base hover:[&_li_a]:!text-medusa-fg-base hover:[&_li_span]:!text-medusa-fg-base"
              )}
            />
            <HomepageTopSection />
            {/* <HomepageCloudSection /> */}
            <HomepageLinksSection />
            <HomepageRecipesSection />
            <HomepageModulesSection />
            <HomepageFooter />
          </div>
          <AiAssistantChatWindow />
        </Providers>
      </RootProviders>
    </body>
  )
}

export default Homepage
