# Panel Reference Images

This folder is for panel reference textures.

## IMPORTANT: Copyright Notice

If adding a reference photo of an actual panel:
- This is likely copyrighted material (manufacturer or stock photography)
- Using it as a licensed reference to build a matching procedural material is fine for internal/personal use
- For distribution or commercial use, replace with:
  - Manufacturer press-kit assets (with permission)
  - Your own photography
  - A generated/procedural texture that doesn't reproduce the original pixels

## Current Implementation

The current panel textures are fully procedural (generated via canvas):
- Base color: dark blue-black (#0a0a0d)
- Cell grid with fine busbar lines (11 vertical, 3 horizontal per cell)
- Subtle glass reflection gradient
- Separate roughness and bump maps for realistic lighting

The panel geometry is also fully procedural with:
- Proper dimensions per wattage tier (400W/550W/650W)
- Double-line frame (outer edge + inner inset)
- Horizontal crossbar
- Mounting hole details

To add a reference image:
1. Place your image at `panel-reference.jpg` in this folder
2. Update the texture generation code to optionally use the image
3. Ensure you have proper licensing/permission for any distributed use
