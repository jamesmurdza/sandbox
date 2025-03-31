import Logo from "@/assets/logo.svg"
import CustomButton from "@/components/ui/customButton"
import { ChevronRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "../ui/button"
import { ThemeSwitcher } from "../ui/theme-switcher"

export default function Landing() {
  return (
    <div className="w-screen h-screen flex justify-center overflow-hidden overscroll-none">
      <div className="w-full max-w-screen-md px-8 flex flex-col items-center relative">
        <div className="w-full flex items-center justify-between py-8">
          <div className="flex items-center font-medium">
            <Image
              src={Logo}
              alt="Logo"
              width={36}
              height={36}
              className="mr-2"
            />
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="icon" asChild>
              <a href="https://x.com/gitwitdev" target="_blank">
                <svg
                  width="1200"
                  height="1227"
                  viewBox="0 0 1200 1227"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-[1.125rem] text-muted-foreground"
                >
                  <path
                    d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z"
                    fill="currentColor"
                  />
                </svg>
              </a>
            </Button>

            <ThemeSwitcher />
          </div>
        </div>
        <h1 className="text-2xl font-medium text-center mt-16">
          A Collaborative + AI-Powered Code Environment
        </h1>
        {/* <p className="text-muted-foreground mt-4 text-center ">
          Sandbox is an open-source cloud-based code editing environment with
          custom AI code autocompletion and real-time collaboration.
        </p> */}
        <p className="text-muted-foreground mt-4 text-center ">
          A cloud-based code editor featuring real-time collaboration,
          intelligent code autocompletion, and an AI assistant to help you code
          faster and smarter.
        </p>
        <div className="mt-8 flex space-x-4">
          <Link href="/sign-up">
            <CustomButton>Go To App</CustomButton>
          </Link>
          <a
            href="https://github.com/jamesmurdza/sandbox"
            target="_blank"
            className="group h-9 px-4 py-2 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            GitHub Repository
            <ChevronRight className="h-4 w-4 ml-1 transition-all group-hover:translate-x-1" />
          </a>
        </div>
      </div>
    </div>
  )
}
