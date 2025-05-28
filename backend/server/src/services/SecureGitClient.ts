import fs from "fs"
import os from "os"
import path from "path"
import simpleGit, { SimpleGit } from "simple-git"
import * as tar from "tar"

export type FileData = {
  id: string
  data: string
}

export class SecureGitClient {
  private gitUrl: string
  private sshKeyPath: string

  constructor(gitUrl: string, sshKeyPath: string) {
    this.gitUrl = gitUrl
    this.sshKeyPath = sshKeyPath
  }

  async pushFiles(tarBase64: string, repository: string): Promise<void> {
    let tempDir: string | undefined

    try {
      // Create a temporary directory
      tempDir = fs.mkdtempSync(path.posix.join(os.tmpdir(), "git-push-"))
      console.log(`Temporary directory created: ${tempDir}`)

      // Decode the base64 string to a buffer
      const tarBuffer = Buffer.from(tarBase64, "base64")
      // Write the tar file to the temp directory
      const tarPath = path.posix.join(tempDir, "archive.tar")
      fs.writeFileSync(tarPath, tarBuffer)

      // Extract the tar archive with the tar package
      await tar.extract({
        file: tarPath,
        cwd: tempDir,
      })

      console.log(`Files extracted from tar archive to ${tempDir}`)

      // Initialize the simple-git instance with the temporary directory and custom SSH command
      const git: SimpleGit = simpleGit(tempDir, {
        config: [
          "core.sshCommand=ssh -i " +
            this.sshKeyPath +
            " -o IdentitiesOnly=yes",
        ],
      }).outputHandler((_command, stdout, stderr) => {
        stdout.pipe(process.stdout)
        stderr.pipe(process.stderr)
      })

      // Initialize a new Git repository
      await git.init()

      // Add remote repository
      await git.addRemote("origin", `${this.gitUrl}:${repository}`)

      // Add all files to the repository and commit the changes
      await git.add(".")
      await git.commit("Add files.")

      // Push the changes to the remote repository
      await git.push("origin", "master", { "--force": null })

      console.log("Files successfully pushed to the repository")
    } catch (error) {
      console.error("Error pushing files to the repository:", error)
      throw error
    } finally {
      if (tempDir) {
        // Delete the temporary directory whether there was an errror or not
        fs.rmSync(tempDir, { recursive: true, force: true })
        console.log(`Temporary directory removed: ${tempDir}`)
      }
    }
  }
}
