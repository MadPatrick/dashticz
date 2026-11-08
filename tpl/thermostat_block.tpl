{{#if meter}}
<div class="col-icon setpoint-arc-icon">
    {{#if mImage}}<img src="img/{{mImage}}" class="on icon">{{/if}}
    {{#if mIcon}}<em class="{{mIcon}} on icon" style="max-height:35px;"></em>{{/if}}
</div>
<div class="setpoint-arc-tile">
    <div class="setpoint-arc">
        {{{arcSvg}}}
        <div class="setpoint-arc-text col-data">
            <strong class="title">{{title}}</strong>
            <br />
            <span class="value setpoint-arc-value">{{value}}</span>
            {{#if showinfo}}
            <br />
            <span class="lastupdate">{{lastupdate}}</span>
            {{/if}}
        </div>
    </div>
    <div class="setpoint-arc-bottom">
        {{#if buttons}}
        <div class="setpoint-arc-btn">
        <a href="javascript:void(0)" class="btn btn-number min" data-type="minus"
            data-field="quant[{{idx}}]" onclick="this.blur();">
            <em class="fas fa-minus fa-small fa-thermostat"></em>
        </a>
        </div>
        {{/if}}
        <div class="setpoint-graph"></div>
        {{#if buttons}}
        <div class="setpoint-arc-btn">
        <a href="javascript:void(0)" class="btn btn-number plus" data-type="plus"
            data-field="quant[{{idx}}]" onclick="this.blur();">
            <em class="fas fa-plus fa-small fa-thermostat"></em>
        </a>
        </div>
        {{/if}}
    </div>
</div>
{{else}}
{{#if buttons}}
<div class="col-button1">
    <div class="up">
        <a href="javascript:void(0)" class="btn btn-number plus" data-type="plus"
            data-field="quant[{{idx}}]" onclick="this.blur();">
            <em class="fas fa-plus fa-small fa-thermostat"></em>
        </a>
    </div>
    <div class="down">
        <a href="javascript:void(0)" class="btn btn-number min" data-type="minus"
            data-field="quant[{{idx}}]" onclick="this.blur();">
            <em class="fas fa-minus fa-small fa-thermostat"></em>
        </a>
    </div>
</div>
{{/if}}
<div class="col-xs-2 col-icon">
    {{#if mImage}}<img src="img/{{mImage}}" class="on icon">{{/if}}
    {{#if mIcon}}<em class="{{mIcon}} on icon" style="max-height:35px;"></em>{{/if}}
</div>
<div class="col-xs-8 col-data {{#buttons}}right1col{{/buttons}}">
    <strong class="title">{{title}}</strong>
    <br />
    <span class="value">{{value}}</span>
    <br />
    {{#if showinfo}}
    <span class="lastupdate">{{lastupdate}}</span>
    {{/if}}
    <div class="setpoint-graph"></div>
</div>
{{/if}}
