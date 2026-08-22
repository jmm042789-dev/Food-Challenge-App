import math
import unittest
from copy import deepcopy
from pydantic import ValidationError

from models import MatchInputEvent
from services.match_validation import InputReplayError, replay_input_log
from tests.test_match_anti_cheat import active_match


def event(**values):
    base = {"seq": 1, "t_ms": 200, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}
    base.update(values)
    return base


class InputGeometryV2Tests(unittest.TestCase):
    def test_valid_control_and_food_bites_replay(self):
        self.assertEqual(replay_input_log(active_match(), [event()])["accepted_taps"], 1)
        self.assertEqual(replay_input_log(active_match(), [event(source="FOOD", x=0.5, y=0.5)])["accepted_taps"], 1)

    def test_outside_food_and_missing_geometry_are_rejected(self):
        with self.assertRaises(InputReplayError) as raised:
            replay_input_log(active_match(), [event(source="FOOD", x=1.0, y=1.0)])
        self.assertEqual(raised.exception.reason, "outside_food_hitbox")
        with self.assertRaises(InputReplayError):
            replay_input_log(active_match(), [{"seq": 1, "t_ms": 200, "type": "BITE"}])

    def test_slice_requires_real_geometry_and_correct_mode(self):
        active = active_match(); active["contest_id"] = "pizza-hut-stuffed"
        active["challenge_config"].update({"contest_id": "pizza-hut-stuffed", "bite_mechanic": "swipe"})
        valid = event(type="SLICE", x=None, y=None, start_x=0.1, start_y=0.5, end_x=0.8, end_y=0.5, duration_ms=180)
        self.assertEqual(replay_input_log(active, [valid])["accepted_taps"], 1)
        for bad in (
            event(type="SLICE", x=None, y=None, start_x=0.5, start_y=0.5, end_x=0.51, end_y=0.5, duration_ms=180),
            event(type="SLICE", x=None, y=None, start_x=0.1, start_y=0.5, end_x=0.8, end_y=0.5, duration_ms=10),
            event(),
        ):
            with self.assertRaises(InputReplayError): replay_input_log(active, [bad])

    def test_hold_requires_control_region_and_timing_zone(self):
        active = active_match(); active["contest_id"] = "ben-jerry-icecream"
        active["challenge_config"].update({"contest_id": "ben-jerry-icecream", "bite_mechanic": "hold_release"})
        valid = event(x=None, y=None, start_x=0.5, start_y=0.5, end_x=0.5, end_y=0.5, duration_ms=600)
        self.assertEqual(replay_input_log(active, [valid])["accepted_taps"], 1)
        with self.assertRaises(InputReplayError): replay_input_log(active, [{**valid, "duration_ms": 100}])
        with self.assertRaises(InputReplayError): replay_input_log(active, [{**valid, "source": "FOOD"}])

    def test_schema_rejects_nonfinite_and_string_geometry(self):
        for value in (math.nan, math.inf, "0.5"):
            with self.assertRaises(ValidationError):
                MatchInputEvent(seq=1, t_ms=1, type="BITE", source="CONTROL", x=value, y=0.5)


if __name__ == "__main__": unittest.main()