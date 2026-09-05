# Image Editoo - Simple Image Editor

A lightweight image editing tool for loading images and adding shapes, arrows, text, and mosaic effects.

### Main features

**Drawing tools**
- Rectangles and rounded rectangles
- Circles and ellipses
- Arrows
- Text input
- Mosaic effects

**Image input and output**
- Load images from local files
- Paste images directly from the clipboard with Ctrl+V / Cmd+V
- Copy edited images back to the clipboard for pasting into other apps

**Customization**
- Color palette and custom color picker
- Adjustable line width from 2px to 10px
- Adjustable text size from 12px to 32px

**Intuitive editing**
- Select, move, and resize shapes
- Undo and redo editing operations
- Crop images to a selected area
- Zoom and pan around the canvas
- Enter text directly on the canvas
- Real-time preview
- Simple keyboard shortcuts

**Save and share**
- Save edited images as PNG files
- One-click download
- Copy the edited image to the clipboard

### Privacy

- Images are processed locally and are not sent to external servers
- Clipboard permission is used only for image paste and copy features
- No personal information is collected

### Changelog

#### v0.5.0
- Added undo and redo for drawing, moving, resizing, color changes, and other editing operations
- Added cropping with pixel dimensions and an adjustable selection area
- Added zoom controls, mouse-wheel zooming, and canvas panning with Space+drag
- Added on-screen image dimensions and zoom percentage
- Improved mosaic accuracy and prevented selection outlines and other editing guides from appearing in saved or copied images

#### v0.4.0
- Fixed pasted images so their resolution is not reduced
- Improved arrow design

#### v0.3.0
- Added clipboard copy so edited images can be pasted directly into other apps

#### v0.2.0
- Improved arrow design with a curved arrow that becomes thicker toward the tip
- Added automatic setting persistence for color, line width, and font size with localStorage
- Added the ability to create a new canvas with a specified size

#### v0.1.1
- Initial release
- Basic shape drawing
- Text input
- Mosaic effects
- Clipboard support
