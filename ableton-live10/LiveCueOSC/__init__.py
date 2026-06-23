# LiveCueOSC — Ableton Live 10 remote script for LiveCue.
# Live 10 runs remote scripts under Python 2.7.
from .LiveCueOSC import LiveCueOSC


def create_instance(c_instance):
    return LiveCueOSC(c_instance)
