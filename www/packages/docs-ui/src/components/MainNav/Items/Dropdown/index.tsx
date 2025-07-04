"use client"

import { TriangleDownMini } from "@medusajs/icons"
import clsx from "clsx"
import React, { useRef, useState } from "react"
import { NavigationItemDropdown } from "types"
import { Menu } from "../../../.."
import { MainNavItemLink } from "../Link"

type MainNavItemDropdownProps = {
  item: NavigationItemDropdown
  isActive: boolean
  className?: string
  wrapperClassName?: string
}

export const MainNavItemDropdown = ({
  item,
  isActive,
  className,
  wrapperClassName,
}: MainNavItemDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const getItemContent = () => {
    if (item.link) {
      return (
        <MainNavItemLink
          item={{
            ...item,
            link: item.link!,
            type: "link",
          }}
          isActive={isActive}
          icon={
            <TriangleDownMini
              className={clsx("transition-transform", isOpen && "rotate-180")}
            />
          }
          className="!flex"
        />
      )
    }

    return (
      <div
        className={clsx(
          "cursor-pointer flex gap-docs_0.25 items-center py-docs_0.25 px-docs_0.5",
          isActive && "text-medusa-fg-base",
          !isActive && [
            "text-medusa-fg-muted hover:text-medusa-fg-subtle",
            isOpen && "text-medusa-fg-subtle",
          ],
          className
        )}
        tabIndex={-1}
      >
        <span className="text-compact-small-plus">{item.title}</span>
        <TriangleDownMini
          className={clsx("transition-transform", isOpen && "rotate-180")}
        />
      </div>
    )
  }

  return (
    <div
      className={clsx("relative", wrapperClassName)}
      ref={ref}
      onMouseOver={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {getItemContent()}
      <div className="absolute top-full -left-docs_0.75 pt-docs_0.25">
        <Menu
          className={clsx("min-w-[190px]", !isOpen && "hidden")}
          items={item.children}
          itemsOnClick={() => setIsOpen(false)}
        />
      </div>
    </div>
  )
}
