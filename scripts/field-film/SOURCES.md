# Field film: real footage, original edit

The 24-second homepage loop is an original edit of six live-action clips. All clips are licensed under the [Pexels License](https://www.pexels.com/license/). They illustrate software, electronics, robotic machinery and drone operation; they are not footage of Vraelis hardware, customers or a Vraelis check. No generated imagery, borrowed company film, globe, or floating product screen appears in this edit.

| Shot | Source |
|---|---|
| Code on a screen | https://www.pexels.com/video/5473798/ |
| Electronics work | https://www.pexels.com/video/4709394/ |
| A warehouse robot handling pallets | https://www.pexels.com/video/16938947/ |
| A drone controller in use | https://www.pexels.com/video/9950493/ |
| Drone in flight at sunset | https://www.pexels.com/video/18352221/ |
| A drone being caught by hand | https://www.pexels.com/video/9940820/ |

Rebuild with `python3 scripts/field-film/compose.py /path/to/downloaded/clips`. Name the original clips `code.mp4`, `circuit.mp4`, `robot.mp4`, `controller.mp4`, `flight.mp4` and `catch.mp4`. The script makes reviewed landscape and portrait crops, applies a restrained common grade, and outputs silent H.264 MP4s and matching posters. Cuts are deliberate edits, including the loop boundary; footage is never frozen to create a longer shot. Runtime is 24 seconds at 30 fps.
