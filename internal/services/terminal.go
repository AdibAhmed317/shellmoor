package services

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"

	"github.com/aymanbagabas/go-pty"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type TerminalService struct {
	pt pty.Pty
}

func (t *TerminalService) StartTerminal() {
	if t.pt != nil {
		return
	}

	var err error
	t.pt, err = pty.New()
	if err != nil {
		fmt.Println("Error creating PTY:", err)
		return
	}

	// 1. Default to powershell on Windows, auto-detect on Mac/Linux
	shellPath := "powershell.exe"
	
	if runtime.GOOS != "windows" {
		shellPath = os.Getenv("SHELL")
		if shellPath == "" {
			shellPath = "/bin/bash"
		}
	}

	// 2. Safety check
	if _, err := exec.LookPath(shellPath); err != nil {
		fmt.Printf("Shell not found: %s, falling back.\n", shellPath)
		if runtime.GOOS == "windows" {
			shellPath = "cmd.exe"
		} else {
			shellPath = "/bin/sh"
		}
	}

	// 3. Setup command
	var cmd *pty.Cmd
	if runtime.GOOS == "windows" && shellPath == "powershell.exe" {
		cmd = t.pt.Command(shellPath, "-NoLogo", "-NoProfile")
	} else {
		cmd = t.pt.Command(shellPath)
	}

	if err := cmd.Start(); err != nil {
		fmt.Println("Error starting shell:", err)
		return
	}

	go func() {
		buf := make([]byte, 1024)
		for {
			n, err := t.pt.Read(buf)
			if err != nil {
				return
			}
			application.Get().Event.Emit("pty:data", string(buf[:n]))
		}
	}()
}

func (t *TerminalService) WriteInput(data string) {
	if t.pt != nil {
		t.pt.Write([]byte(data))
	}
}

func (t *TerminalService) Resize(cols int, rows int) {
	if t.pt != nil {
		t.pt.Resize(cols, rows)
	}
}

func (t *TerminalService) ServiceShutdown() error {
	if t.pt != nil {
		// Kill the shell process
		t.pt.Close()
		t.pt = nil
	}
	return nil
}