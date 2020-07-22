class Chart {
    constructor(c) {
	this.c = c;
	this.width = 1100;
	this.height = 500;
	this.margin_left = 50;
	this.margin_top = 50;
	this.loadParams();
	this.svg = this.c.append('svg')
	    .attr('preserveAspectRatio', 'xMinYMin meet')
	    .attr('class', 'chart')
	    .attr('viewBox', '0 0 1200 600');
	this.svg.append('rect')
	    .attr('class', 'chart')
	    .attr('x', 0)
	    .attr('y', 0);
	this.g = this.svg
	    .append('g')
	    .attr('transform', `translate(${this.margin_left}, ${this.margin_top})`);
    }

    loadParams() {
	this.scale = this.c.select('div.param input[name="scale"]:checked')
	    .node().value;
    }
    
    showLoading() {
	let s = this.c.insert('div', ':first-child')
	    .attr('class', 'lds-ripple')
	    .attr('id', 'spinner');
	
	s.append('div'); 
	s.append('div');
    }

    showError() {
	this.c.select('div#spinner')
	    .selectAll('div')
	    .style('border-color', '#ff0000')
	    .style('animation-play-state', 'paused')
    }

    hideLoading() {
	this.c.select('div#spinner').remove();
    }

    async load(source) {
	try {
	    this.hideLoading();
	    this.showLoading();
	    let data = await source;
	    this.hideLoading();
	    this.transform(data);
	    this.refresh();
	} catch (error) {
	    this.showError();
	    alert(`${error.message}: \n\n${error.stack}`);
	}
    }

    filter(data) {
	return data.filter(
	    d => ['Alameda',
		  'Contra Costa',
		  'Marin',
		  'Santa Clara',
		  'San Francisco',
		  'Sonoma',
		  'Napa',
		  'San Mateo',
		  'Solano'].includes(d.key))
	    .map(function (d) {
		d.value = d.value.filter(
		    d => d.todays_date >= Date.parse('Apr 01 2020'));
		return d;
	    });
    }
    
    transform(data) {
	if (data.success) {
	    this.raw_data = d3.nest()
		.key(d => d.county)
		.rollup(function (v) {
		    let sum_hosp = 0.0;
		    let sum_susp = 0.1;
		    return v.map(function (d) {
			sum_hosp += parseInt(d.hospitalized_covid_patients || 0);
			d.hospitalized_covid_patients = sum_hosp;
			sum_susp += parseInt(d.hospitalized_suspected_covid_patients || 0);
			d.hospitalized_suspected_covid_patients = sum_susp;
			d.todays_date = Date.parse(d.todays_date);
			return d;
		    })
		}) 
		.entries(data.result.records);
	} else {
	    this.showError();
	}
    }

    y_value(d) {
	return Math.trunc(d.hospitalized_covid_patients
			  + d.hospitalized_suspected_covid_patients);
    }
    
    refresh() {
	this.data = this.filter(this.raw_data);
	this.colors = d3.scaleOrdinal(this.data.map(d => d.key), d3.schemeTableau10);
	this.min_x = this.data[0].value[0].todays_date;
	this.max_x = this.data[0].value[this.data[0].value.length - 1].todays_date;
	this.min_y = 0.1;
	this.max_y = d3.max(this.data, d => this.y_value(d.value[d.value.length - 1]));
	this.x = d3.scaleTime([this.min_x, this.max_x], [0, this.width]);
	switch (this.scale) {
	case 'lin':
	    this.y = d3.scaleLinear([this.min_y, this.max_y], [this.height, 0]);
	    break;
	case 'log':
	default:
	    this.y = d3.scaleLog([this.min_y, this.max_y], [this.height, 0]).base(10);
	    break;
	}

	this.g.selectAll().remove();
	this.drawAxes();
	this.drawSeries();
    }

    drawAxes() {
	let x_axis = this.g.selectAll('g.x.axis').data(d => [d]);
	x_axis.enter()
	    .append('g')
	    .attr('class', 'x axis')
	    .attr('transform', `translate(0, ${this.height})`)
	    .merge(x_axis)
	    .transition()
	    .duration(400)
	    .call(d3.axisBottom(this.x));

	let y_axis = this.g.selectAll('g.y.axis').data(d => [d]);
	y_axis.enter()
	    .append('g')
	    .attr('class', 'y axis')
	    .merge(y_axis)
	    .transition()
	    .duration(400)
	    .call(d3.axisLeft(this.y).ticks(6, 'd'));

	let y_axis_grid = this.g.selectAll('g.y.axis_grid').data(d => [d]);
	y_axis_grid.enter()
	    .append('g')
	    .attr('class', 'y axis_grid')
	    .merge(y_axis_grid)
	    .transition()
	    .duration(400)
	    .call(d3.axisLeft(this.y)
		  .tickSize(-this.width)
		  .ticks(6)
		  .tickFormat(''));
    }

    drawSeries() {
	let g = this.g.selectAll('g.series').data(d => [d]);
	g = g.enter()
	    .append('g')
	    .attr('class', 'series')
	    .merge(g);

	let line = d3.line()
	    .x(d => this.x(d.todays_date))
            .y(d => this.y(this.y_value(d)));
	let lines = g.selectAll('path').data(this.data, d => d.key);
	lines.enter()
	    .append('path')
	    .attr('class', 'line')
	    .merge(lines)
	    .transition()
	    .duration(500)
	    .attr('stroke', d => this.colors(d.key))
	    .attr('d', d => line(d.value));
	lines.exit().remove();

	g.selectAll('rect.overlay').data(d => [d])
	    .enter()
	    .append('rect')
	    .attr('class', 'overlay')
	    .style('fill', 'none')
	    .attr('width', this.width)
	    .attr('height', this.height)
	    .style('pointer-events', 'all')
	    .on('mousemove', (d, i, nodes) => this.drawAnnotation(d3.mouse(nodes[i])))
	    .on('mouseover', () => this.showAnnotation())
	    .on('mouseout', () => this.hideAnnotation());
    }

    legendData(date, bisect) {
	let self = this;
	return this.data.map(function (d) {
	    let x = bisect.left(d.value, date); 
	    return {key : d.key,
		    value : self.y_value(d.value[x]),
		    
		   };
	}).sort((a, b) => d3.descending(a.value, b.value));
    }
    
    drawAnnotation(mouse) {
	let g = this.g.selectAll('g.annotation').data(d => [d]);
	g = g.enter()
	    .append('g')
	    .attr('class', 'annotation')
	    .style('pointer-events', 'none')
	    .merge(g);

	let x_intercept = d3.line()
	    .x(() => mouse[0])
	    .y(d => d);
	let mouse_line = g.selectAll('path')
	    .data(d => [d]);
	mouse_line.enter()
	    .append('path')
	    .attr('class', 'x_intercept')
	    .merge(mouse_line)
	    .attr('d', d => x_intercept([0, this.height]));

	let date = this.x.invert(mouse[0]);
	let bisect = d3.bisector(d => d.todays_date);
	let circles = g.selectAll('circle').data(this.data, d => d.key);
	let self = this;
	circles.enter()
	    .append('circle')
	    .style('fill', d => this.colors(d.key))
	    .merge(circles)
	    .attr('r', 2)
	    .attr('cx', mouse[0])
	    .attr('cy', function (d) {
		let i_right = Math.min(d.value.length - 1, bisect.right(d.value, date));
		let i_left = Math.max(0, i_right - 1);
		let frac = (date.getSeconds()
			    + date.getMinutes() * 60
			    + date.getHours() * 60 * 60) / 86400;
		return self.y(d3.interpolate(self.y_value(d.value[i_left]),
					     self.y_value(d.value[i_right]))(frac));
	    });

	let legend = g.selectAll('g.legend').data(d => [d]);
	let legend_new = legend.enter()
	    .append('g')
	    .attr('class', 'legend');
	legend = legend_new.merge(legend);
	let legend_box = legend.node().getBBox();
	legend.attr('transform', function(d) {
	    let x = mouse[0] <= self.width / 2 ?
		mouse[0] :
		mouse[0] - legend_box.width - 20;
	    let y = mouse[1] <= self.height / 2 ?
		mouse[1] :
		mouse[1] - legend_box.height - 20;
	    return `translate(${x}, ${y})`;
	});

	this.legend = this.legendData(date, bisect);
	let legend_rows = legend.selectAll('g.legend-row').data(this.legend, d => d.key);
	let legend_rows_new = legend_rows.enter()
	    .append('g')
	    .attr('class', 'legend-row');
	legend_rows_new.append('rect')
	    .style('fill', d => this.colors(d.key))
	    .attr('width', 20)
	    .attr('height', 20);
	legend_rows_new.append('text')
	    .attr('x', 30)
	    .attr('y', '1em');

	legend_rows = legend_rows_new.merge(legend_rows);
	legend_rows.attr('transform', (d, i) =>`translate(10, ${10 + i * 25})`);
	legend_rows.select('text')
	    .text(d => d.key + ' : ' + d.value);
    }
    
    showAnnotation() {
	this.g.selectAll('g.annotation').attr('display', 'visible');
    }

    hideAnnotation() {
	this.g.selectAll('g.annotation').attr('display', 'none');
    }
};


