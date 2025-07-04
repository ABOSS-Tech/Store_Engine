import React, { useEffect, useRef } from "react"
import clsx from "clsx"
import { ArrowUpCircleSolid } from "@medusajs/icons"
import { useAiAssistant } from "../../../../providers"
import { useChat } from "@kapaai/react-sdk"
import { useAiAssistantChatNavigation } from "../../../../hooks"

type AiAssistantChatWindowInputProps = {
  chatWindowRef: React.RefObject<HTMLDivElement | null>
}

export const AiAssistantChatWindowInput = ({
  chatWindowRef,
}: AiAssistantChatWindowInputProps) => {
  const { chatOpened, inputRef, loading } = useAiAssistant()
  const { submitQuery, conversation } = useChat()
  const [question, setQuestion] = React.useState("")
  const formRef = useRef<HTMLFormElement | null>(null)

  const onSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault()
    submitQuery(question)
    setQuestion("")
  }

  const handleKeyboardDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "ArrowUp" && !question) {
      const lastQuestion = conversation.getLatest()?.question
      if (lastQuestion) {
        setQuestion(lastQuestion)
      }
      return
    }
    if (e.key !== "Enter") {
      return
    }
    if (e.shiftKey) {
      const { selectionStart, selectionEnd } = e.currentTarget
      setQuestion(
        (prev) =>
          `${prev.substring(0, selectionStart)}\n${prev.substring(selectionEnd)}`
      )
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.selectionStart = inputRef.current.selectionEnd =
            selectionStart + 1
        }
      }, 0)
    } else {
      onSubmit()
    }
  }

  const adjustTextareaHeight = () => {
    if (!inputRef.current) {
      return
    }
    if (!question.length) {
      inputRef.current.style.height = "auto"
      return
    }
    inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
  }

  useEffect(() => {
    adjustTextareaHeight()
    inputRef.current?.focus()
  }, [question])

  const handleTouch = (e: React.TouchEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    inputRef.current?.focus({
      preventScroll: true,
    })
  }

  useEffect(() => {
    if (!chatOpened || !inputRef.current) {
      return
    }

    const isCursorAtEnd =
      inputRef.current.selectionStart === inputRef.current.value.length

    if (isCursorAtEnd) {
      inputRef.current.scrollTop = inputRef.current.scrollHeight
    }
  }, [chatOpened, inputRef.current])

  useAiAssistantChatNavigation({
    getChatWindowElm: () => chatWindowRef.current as HTMLElement | null,
    getInputElm: () => inputRef.current as HTMLTextAreaElement | null,
    focusInput: () =>
      inputRef.current?.focus({
        preventScroll: true,
      }),
    question,
  })

  return (
    <div
      className={clsx(
        "px-docs_1 py-docs_0.75 border-t border-medusa-border-base"
      )}
    >
      <form
        className="flex flex-col gap-docs_0.5"
        onSubmit={onSubmit}
        ref={formRef}
      >
        <textarea
          className={clsx(
            "appearance-none text-base md:text-small placeholder:text-medusa-fg-muted",
            "text-medusa-fg-base max-h-[210px] overflow-auto resize-none bg-transparent",
            "focus:outline-none focus:ring-0 disabled:cursor-not-allowed max-h-[210px]",
            "disabled:!bg-transparent disabled:text-medusa-fg-disabled disabled:placeholder:text-medusa-fg-disabled"
          )}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyboardDown}
          onTouchStart={handleTouch}
          onTouchMove={handleTouch}
          onTouchEnd={handleTouch}
          ref={inputRef as React.RefObject<HTMLTextAreaElement | null>}
          placeholder="Ask me a question about Medusa..."
          disabled={loading}
        />
        <div className="flex items-center justify-end">
          <button
            className={clsx(
              "appearance-none p-0 text-medusa-fg-base disabled:text-medusa-fg-disabled",
              "transition-colors"
            )}
            disabled={!question || loading}
          >
            <ArrowUpCircleSolid />
          </button>
        </div>
      </form>
    </div>
  )
}
