package main

import (
	"embed"
	"log"

	"github.com/AdibAhmed317/shellmoor/internal/services"
	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := application.New(application.Options{
		Name:        "shellmoor",
		Description: "A beautiful, fast terminal.",
		Services: []application.Service{
			application.NewService(&services.TerminalService{}),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	// NEW API: app.Window.NewWithOptions instead of app.NewWebviewWindowWithOptions
	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "shellmoor",
		Width:  1024,
		Height: 768,
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}