import { SignIn } from "@clerk/nextjs"
import { dark } from "@clerk/themes"

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn
        appearance={{
          baseTheme: dark,
          elements: {
            rootBox: {
              width: "100%",
              maxWidth: "400px",
            },
            card: {
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "12px",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
              width: "100%",
            },
            headerTitle: {
              color: "#ffffff",
              fontSize: "24px",
              fontWeight: "600",
            },
            headerSubtitle: {
              color: "#9ca3af",
              fontSize: "14px",
            },
            socialButtonsBlockButton: {
              backgroundColor: "#2a2a2a",
              color: "#ffffff",
              border: "1px solid #404040",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "500",
              "&:hover": {
                backgroundColor: "#333333",
                borderColor: "#555555",
              },
            },
            socialButtonsBlockButtonText: {
              color: "#ffffff",
              fontWeight: "500",
            },
            dividerLine: {
              backgroundColor: "#404040",
              height: "1px",
            },
            dividerText: {
              color: "#9ca3af",
              fontSize: "12px",
            },
            formFieldLabel: {
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: "500",
            },
            formFieldInput: {
              backgroundColor: "#2a2a2a",
              color: "#ffffff",
              border: "1px solid #404040",
              borderRadius: "6px",
              "&:focus": {
                borderColor: "#6366f1",
                boxShadow: "0 0 0 2px rgba(99, 102, 241, 0.2)",
              },
            },
            formButtonPrimary: {
              backgroundColor: "#6366f1",
              color: "#ffffff",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "500",
              "&:hover": {
                backgroundColor: "#5856eb",
              },
            },
            footerActionLink: {
              color: "#6366f1",
              fontSize: "14px",
              "&:hover": {
                color: "#5856eb",
              },
            },
            footerActionText: {
              color: "#9ca3af",
              fontSize: "14px",
            },
            identityPreviewText: {
              color: "#ffffff",
            },
            identityPreviewEditButton: {
              color: "#6366f1",
            },
          },
        }}
      />
    </div>
  )
}
