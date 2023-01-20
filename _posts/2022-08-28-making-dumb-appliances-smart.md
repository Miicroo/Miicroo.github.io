---
layout: post
title: "Making dumb appliances smart ⚡"
date: 2022-08-28 XX:00:00 +0100
categories: [technology, energy, electricity]
author: miicroo
image: assets/images/smartify-appliances/thumbnail.jpg
toc: true

lovelace_finished: /assets/images/smartify-appliances/lovelace_finished.png
power_throughout_cycle: /assets/images/smartify-appliances/power_throughout_cycle.png
washing_machine_states: /assets/images/smartify-appliances/washing_machine_states.png
timer: /assets/images/smartify-appliances/timer.gif
---
In many homes there are lots of traditional, non-connected appliances that can be controlled and monitored with HomeAssistant.
In this article I will show you how to collect data and visualize an appliance, to further smartify your home.

### Prerequisites
The only prerequisite for this project is a smart plug with energy monitoring. Here are a few options:
* <a href="https://shelly.cloud/products/shelly-plug-s-smart-home-automation-device/" target="_blank">Shelly Plug S</a>
* <a href="https://www.tp-link.com/se/home-networking/smart-plug/hs110/" target="_blank"><s>TP-Link Kasa HS110</s></a> (about to be discontinued, do not buy new ones)
* <a href="https://aqara.com/eu/smart_outlet.html" target="_blank">Aqara Plug</a>

### What we will build
The idea is to use a smart plug with energy monitoring to determine which state the appliance is in, and based on state make smart decisions such as notifications and announcements.  

These are the questions we will answer in this post:
* If the appliance is cyclic, how long does an average cycle take?
* If the appliance is running, how long until it is finished?
* What is the daily power usage?
* What is the daily cost?

The data will then be used in a lovelace view like this:

![Finished lovelace]({{page.lovelace_finished}})


## Getting started
We will build this tutorial around a washing machine, however the idea can be applied to any appliance.

### Defining states
We define the states the appliance can have, and add them to an `input_select`, so that we can toggle the state based on changes in energy consumption.
```yaml
input_select:
  washing_machine_status:
    name: Washing machine status
    options:
      - "On"
      - "Running"
      - "Finished"
      - "Off"
    icon: mdi:washing-machine
```

### Automating state transitions
Now, we add 4 automations that describe how to get to each state. Some states can only be reached if the appliance was previously in another specific state, such as *Finished* which can only be reached from *Running*. 
The easiest state changes are `On` and `Off`, as they are the same as the state of the switch. To determine `Running` and `Finished`, we run a cycle of the washing machine and inspect the values in HomeAssistant.
![Power throughout cycle]({{page.power_throughout_cycle}})

In this case the machine is `Running` if it uses more than 1.5W for 1 minute, and it is `Finished` when it uses less than 1.6W for 3 minutes.
> **NOTE**: It is always good to analyze multiple cycles to determine correct values, since we don't want to turn off the appliance in the middle of a cycle.

The state machine looks like this:  
![Washing machine states]({{page.washing_machine_states}})

```yaml
automation:
  - alias: Washing machine on
    trigger:
      platform: state
      entity_id: switch.washing_machine
      from: 'off'
      to: 'on'
    action:
      - service: input_select.select_option
        data:
          entity_id: input_select.washing_machine_status
          option: 'On'

  - alias: Washing machine off
    trigger:
      platform: state
      entity_id: switch.washing_machine
      from: 'on'
      to: 'off'
    action:
      - service: input_select.select_option
        data:
          entity_id: input_select.washing_machine_status
          option: 'Off'

  - alias: Washing machine running
    trigger:
      platform: numeric_state
      # The entity_id is the smart plug sensor with the current consumption (W). Note: not the total consumption.
      entity_id: sensor.washing_machine_current_consumption
      above: 1.5
      for:
        minutes: 1
    condition:
      - condition: template
        # Must go from 'On' -> 'Running'
        value_template: "{ { states('input_select.washing_machine_status') == 'On' }}"
    action:
      - service: input_select.select_option
        data:
          entity_id: input_select.washing_machine_status
          option: 'Running'

  - alias: Washing machine finished
    trigger:
      platform: numeric_state
      # The entity_id is the smart plug sensor with the current consumption (W). Note: not the total consumption.
      entity_id: sensor.washing_machine_current_consumption
      below: 1.6
      for:
        minutes: 3
    condition:
      - condition: template
        # Must go from 'Running' -> 'Finished'
        value_template: "{ { states('input_select.washing_machine_status') == 'Running' }}"
    action:
      - service: input_select.select_option
        data:
          entity_id: input_select.washing_machine_status
          option: 'Finished'
```

## Answering questions
We now have a full state machine of our appliance, and can start applying that knowledge to build smart functions.

### If the appliance is cyclic, how long does an average cycle take?
A washing machine is definitely cyclic, and we can add some more entities to check how long an average cycle takes.
To be able to restart HomeAssistant during a wash without losing any data, we store the start time in an `input_datetime`.

```yaml
input_datetime:
  washing_machine_last_start:
    name: Washing machine last start
    has_date: true
    has_time: true
```

Whenever the machine moves into `Running` state, we update the value using an automation:
```yaml
- alias: React on washing machine running
  trigger:
    platform: state
    entity_id: input_select.washing_machine_status
    to: 'Running'
  action:
    - service: input_datetime.set_datetime
      target:
        entity_id: input_datetime.washing_machine_last_start
      data:
        datetime: "{ { now().strftime('%Y-%m-%d %H:%M:%S') }}"
```

To store the cycle duration we use an `input_number`. In this example we set the unit to minutes, and define a min and max.
```yaml
input_number:
  washing_machine_completion_time:
    name: Time for washing machine cycle
    min: 0
    # Will never take more than 2 hours
    max: 120
    step: 1
```

Lastly, we calculate the cycle duration value when the machine moves into state `Finished` using the start time, and set it to our new `input_number` using an automation:
```yaml
- alias: React on washing machine finished
  trigger:
    platform: state
    entity_id: input_select.washing_machine_status
    to: 'Finished'
  action:
    - service: input_number.set_value
      target:
        entity_id: input_number.washing_machine_completion_time
      data:
        value: "{ { (((as_timestamp(now()) - as_timestamp(states('input_datetime.washing_machine_last_start'))) / 60) | int) }}"
```

To be able to calculate an average cycle duration, we store it in a (templated) `sensor`.
```yaml
template:
  - sensor:
    - name: "Washing machine completion time"
      unit_of_measurement: "minutes"
      state: >
        { { states('input_number.washing_machine_completion_time')|int }}
```

Since not all cycles are equally long, we use a mean value to calculate the best approximate.
```yaml
sensor:
  - platform: statistics
    name: "Washing machine mean completion time"
    entity_id: sensor.washing_machine_completion_time
    state_characteristic: mean
    sampling_size: 5
```
The average cycle duration is now stored as a number in `state(sensor.washing_machine_mean_completion_time)`!


### If the appliance is running, how long until it is finished?
We can use the start datetime and average cycle duration to calculate how long the machine has left to run until this cycle is complete. The formula is `last_start + average_cycle_duration - now()`. Since we have previously used minutes as our unit of measurement, we do the same here.

Once again we utilize the templated sensor:
```yaml
template:
  - sensor:
    - name: "Washing machine time left on cycle"
      unit_of_measurement: "minutes"
      state: >
        { % if states('input_select.washing_machine_status') == 'Running' -%}
          { % set finished_at = as_datetime(states('input_datetime.washing_machine_last_start')) + timedelta(minutes=(states('sensor.washing_machine_mean_completion_time')|int)) %}
          { % set time_until_finished_seconds = as_timestamp(finished_at) - as_timestamp(now()) %}
          { % set minutes = (time_until_finished_seconds / 60) | int %}

          { { minutes }}
        { % else %}
          unknown
        { % endif %}
```

### What is the daily power usage?
To calculate the daily power usage we use the [utility_meter](https://www.home-assistant.io/integrations/utility_meter/) integration in HomeAssistant.
It is also possible to use another cycle than `daily`, for instance `hourly` which can be used to plot a graph.
```yaml
utility_meter:
  washing_machine_power_per_day:
    source: sensor.washing_machine_current_consumption
    cycle: daily
  washing_machine_power_per_hour:
    source: sensor.washing_machine_current_consumption
    cycle: hourly
```

### What is the daily cost?
To calculate the daily cost we use three steps:

1. Calculate current price
2. Integrate current price over time, to get a total cost of all time
3. Create a utility_meter that resets daily

When calculating the current price you can either use a state, for instance `(states("sensor.your_price_sensor_here") | float(0))`, or use a constant like below.
Note that the unit_of_measurement is in *currency*/kWh.
```yaml
sensor:
  - platform: template
    sensors:
      washing_machine_current_price:
        friendly_name_template: "Washing Machine Current Price"
        value_template: '{ { 1.1 * (states("sensor.washing_machine_current_consumption") | float(0) / 1000) }}'
        # Use your own currency here
        unit_of_measurement: '*currency*/h'

  # Total cost
  - platform: integration
    source: sensor.washing_machine_current_price
    name: washing_machine_price
    round: 6

# Reset daily
utility_meter:
  washing_machine_price_per_day:
    source: sensor.washing_machine_price
    cycle: daily
```

## Building a UI
We now have 5 smart sensors to help us monitor our appliance:

| Average completion time | `sensor.washing_machine_mean_completion_time` |
| Time left if running    | `sensor.washing_machine_time_left_on_cycle`   |
| Daily power consumption | `sensor.washing_machine_power_per_day`        |
| Daily price             | `sensor.washing_machine_price_per_day`        |
| Hourly price            | `sensor.washing_machine_price_per_hour`       |

<!-- Force format -->
<br />
To format the code nicely we can use a markdown table to display the static values, and a <a href="https://github.com/kalkih/mini-graph-card" target="_blank">mini-graph-card</a> to display the price per hour throughout the day. To format the values stored in minutes we add two jinja macros; one that can format a time as age (for instance `12 hours ago`), and one that can format a duration in minutes (for instance `78` -> `1 hour 18 minutes`). As a bonus, if the appliance is running, we add an animated timer that shows how long time until the cycle is finished. It can be downloaded [here]({{page.timer}}) and saved to `/config/www/icons/timer.gif`.

Finally, a grid card makes it easy to stack the card with static data on top of the graph.

```yaml
type: grid
square: false
columns: 1
cards:
  - square: false
    columns: 1
    type: grid
    cards:
      - type: markdown
        content: >
          { %- macro format_as_age(other_date_time) -%}

          { %- set timestamp_data = [{'unit':'second', 'in_last_unit': 1},
          {'unit':'minute', 'in_last_unit': 60}, {'unit':'hour',
          'in_last_unit': 60}, {'unit':'day', 'in_last_unit': 24},
          {'unit':'week', 'in_last_unit': 7}, {'unit':'year',
          'in_last_unit': 52}, {'unit':'millenia', 'in_last_unit': 1000}]
          -%}

          { %- set ns = namespace(duration=as_timestamp(now()) -
          as_timestamp(other_date_time), done=False) -%}


          { %- for element in timestamp_data if not ns.done -%}
            { %- if (ns.duration / element.in_last_unit) < timestamp_data[loop.index].in_last_unit -%}
             { %- set value = (ns.duration / element.in_last_unit) | int -%}
             { { value }} { { element.unit }}
             { %- if value > 1 -%}
               s
             { %- endif %} ago
             { % set ns.done = True %}
            { %- endif -%}
            { % set ns.duration = ns.duration / element.in_last_unit %}  
          { %- endfor -%}

          { %- endmacro %}

          { %- macro format_duration(duration_in_minutes) -%}

          { % set hours = (duration_in_minutes / 60) | int -%}

          { % set minutes = (duration_in_minutes % 60) | int %}

          { %- if hours > 0 -%}
            { { hours }} hour
            { %- if hours > 1 -%}
              s  
            { %- endif -%}
          { %- endif -%}

          { %- if minutes > 0 %} { { minutes }} minute
            { %- if minutes > 1 -%}
              s  
            { %- endif -%}
          { %- endif -%}

          { %- endmacro -%}

          ### Washing machine

          { { states('input_select.washing_machine_status') }}, since { {
          format_as_age(states.input_select.washing_machine_status.last_changed)
          }}


          |   |   |

          |---|---|

          { %- if states('input_select.washing_machine_status') == 'Running'
          -%}

          |![Running](/local/icons/timer.gif) | { {
          format_duration((states('sensor.washing_machine_time_left_on_cycle')
          | int)) }} |

          { %- endif %}

          |<ha-icon icon="mdi:timer-sand-complete"></ha-icon> | { {
          format_duration((states('sensor.washing_machine_mean_completion_time')
          | int)) }} |

          |<ha-icon icon="mdi:cash"></ha-icon> | { {
          states('sensor.washing_machine_price_per_day') }} SEK |

          |<ha-icon icon="mdi:lightning-bolt"></ha-icon> | { {
          states('sensor.washing_machine_power_per_day') }} { {
          state_attr('sensor.washing_machine_power_per_day',
          'unit_of_measurement') }}|
  - type: custom:mini-graph-card
    unit: SEK
    icon: mdi:cash
    group_by: hour
    hours_to_show: 24
    day24: true
    decimals: 5
    show:
      name: false
      icon: false
      state: false
      labels: true
    entities:
      - entity: sensor.washing_machine_price_per_hour
        name: Washing machine
        show_state: true
        show_indicator: true
```

This code will render the final UI
![Finished lovelace]({{page.lovelace_finished}})

## Conclusions

