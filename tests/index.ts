import dotenv from "dotenv"
import supertest from "supertest"
import { ClerkAuth } from "./auth.js"

dotenv.config()

/**
 * Main test function that verifies API endpoint access with Clerk authentication
 */
const runTest = async (): Promise<void> => {
  try {
    // Verify required environment variable is set
    if (!process.env.CLERK_TEST_USER_ID) {
      throw new Error("CLERK_TEST_USER_ID environment variable is required")
    }

    // Initialize Clerk authentication and create a test session
    const auth = new ClerkAuth()
    const session = await auth.createTestSession(process.env.CLERK_TEST_USER_ID)
    const jwt = await auth.getSessionToken(session.id)

    // Make authenticated request to the sandbox endpoint
    const response = await supertest("http://localhost:4000")
      .get("/api/sandbox") // Test endpoint
      .set("Authorization", `Bearer ${jwt}`) // Include JWT in Authorization header
      .expect(200) // Expect HTTP 200 OK response

    // Log successful test result
    console.log("Test successful:", response.text)
  } catch (error) {
    // Log detailed error and exit with non-zero status code on failure
    console.error(
      "Test failed:",
      error instanceof Error ? error.message : error
    )
    process.exit(1)
  }
}

runTest().catch((error) => {
  console.error("Unhandled error in test execution:", error)
  process.exit(1)
})
