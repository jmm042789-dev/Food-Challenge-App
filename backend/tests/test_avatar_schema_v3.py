import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.social_service import sanitize_avatar

class AvatarSchemaV4Tests(unittest.TestCase):
    def test_v2_colors_migrate_to_bounded_v3_values(self):
        avatar = sanitize_avatar({"skinTone": "deep", "hairColor": "plum", "hair": "long"})
        self.assertEqual(avatar["skinToneValue"], 72)
        self.assertEqual(avatar["hairColorValue"], 76)
        self.assertEqual(avatar["hair"], "long")
        self.assertEqual(avatar["presentation"], "non_binary")

    def test_v4_values_and_presentations_are_sanitized_field_by_field(self):
        avatar = sanitize_avatar({"presentation": "female", "skinToneValue": 999, "hairColorValue": -4, "glasses": "round"})
        self.assertEqual(avatar["presentation"], "female")
        self.assertEqual(avatar["skinToneValue"], 100)
        self.assertEqual(avatar["hairColorValue"], 0)
        self.assertEqual(avatar["glasses"], "round")

    def test_invalid_numeric_and_presentation_values_use_safe_defaults(self):
        avatar = sanitize_avatar({"presentation": "private", "skinToneValue": "rgb(0,0,0)", "hairColorValue": True})
        self.assertEqual(avatar["presentation"], "non_binary")
        self.assertEqual(avatar["skinToneValue"], 23)
        self.assertEqual(avatar["hairColorValue"], 18)


    def test_v4_cosmetics_are_bounded_and_arbitrary_art_is_dropped(self):
        avatar = sanitize_avatar({
            "hair": "braids", "eyes": "intense", "apron": "competition",
            "accessory": "medal", "image_url": "https://evil.invalid/a.png",
            "svg": "<svg onload=alert(1)>", "headwear": "../../secret",
        })
        self.assertEqual(avatar["hair"], "braids")
        self.assertEqual(avatar["eyes"], "intense")
        self.assertEqual(avatar["apron"], "competition")
        self.assertEqual(avatar["accessory"], "medal")
        self.assertEqual(avatar["headwear"], "none")
        self.assertNotIn("image_url", avatar)
        self.assertNotIn("svg", avatar)

if __name__ == "__main__":
    unittest.main()
