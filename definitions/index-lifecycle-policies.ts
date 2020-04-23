export const ILPs = [
    {
        "policy": "50G30D",
        "body": {
            "policy": {
                "phases": {
                    "hot": {
                        "min_age": "0ms",
                        "actions": {
                            "rollover": {
                                "max_age": "30d",
                                "max_size": "50gb"
                            },
                            "set_priority": {
                                "priority": 100
                            }
                        }
                    }
                }
            }
        }
    }
];
